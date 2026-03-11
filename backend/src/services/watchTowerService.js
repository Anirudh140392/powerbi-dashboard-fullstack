import TbZeptoBrandSalesAnalytics from '../models/TbZeptoBrandSalesAnalytics.js';
import TbZeptoInventoryData from '../models/TbZeptoInventoryData.js';
import TbBlinkitSalesData from '../models/TbBlinkitSalesData.js';
import RbPdpOlap from '../models/RbPdpOlap.js';

import RbKw from '../models/RbKw.js';
import RbBrandMs from '../models/RbBrandMs.js';
import ZeptoMarketShare from '../models/ZeptoMarketShare.js'; // Keeping for reference if needed, but primary is now RbBrandMs
import RcaSkuDim from '../models/RcaSkuDim.js';
import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/db.js';
import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(customParseFormat);

// Helper to escape strings for ClickHouse
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

// Redis cache helpers removed - all queries now hit ClickHouse directly

// Import Redis data layer for indexed platform data (data retrieval only, no caching)
import { ensurePlatformData, queryByFilters, aggregateMetrics, getPlatformStats, isPlatformDataLoaded, coalesceRequest, getBrandMonthlyData } from './redisDataService.js';
import { normalizeFilterArray, getMarketShare, getMarketShareByMonth, getMarketShareByBrand, getMarketShareTimeSeries } from './marketShareHelper.js';

// Global SQL snippet to resolve the Product_Category from Brand if the column is empty
// For chocolate brands (Snickers, Galaxy), uses Product name keywords to distinguish
// Gifting (gift, tin pack, minis) from Non-Gifting
const PRODUCT_CATEGORY_SQL = `if(Product_Category IS NOT NULL AND Product_Category != '' AND Product_Category != '0', 
    Product_Category, 
    multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
            LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 
                   'Chocolates (Gifting)', 
                   'Chocolates (Non Gifting)'), 
            'Others')
)`;

// 🔹 Materialized View Fallback Logic
let aggTableExists = null;
const AGG_TABLE_NAME = 'watchtower_agg_daily';

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

/**
 * Returns the appropriate SQL fields and table name based on data source availability.
 */
async function getWatchtowerSource() {
    const useAgg = await getAggTableStatus();
    if (useAgg) {
        return {
            table: AGG_TABLE_NAME,
            isAgg: true,
            f: {
                sales: 'total_sales',
                spend: 'total_spend',
                adSales: 'total_ad_sales',
                clicks: 'total_clicks',
                impressions: 'total_impressions',
                neno: 'total_neno_osa',
                deno: 'total_deno_osa',
                qty: 'total_qty',
                orders: 'total_orders',
                mrpVal: 'mrp_val',
                actualSales: 'actual_sales',
                date: 'date',
                platform: 'platform',
                brand: 'brand',
                location: 'location',
                category: 'category',
                compFlag: 'comp_flag',
                compFlagMapping: 'comp_flag',
                mrp: 'mrp',
                sellingPrice: 'selling_price',
                product: 'product',
                skuCode: 'sku_code',
                quantitySold: 'total_qty',
                discount: 'if(mrp > 0, (mrp - selling_price) / mrp * 100, 0)',
                listingPercent: 'avg_listing_percent'
            }
        };
    }
    return {
        table: 'rb_pdp_olap',
        isAgg: false,
        f: {
            sales: 'ifNull(toFloat64OrZero(toString(Sales)), 0)',
            spend: 'ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)',
            adSales: 'ifNull(toFloat64OrZero(toString(Ad_sales)), 0)',
            clicks: 'ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0)',
            impressions: 'ifNull(toFloat64OrZero(toString(Ad_Impressions)), 0)',
            neno: 'ifNull(toFloat64OrZero(toString(neno_osa)), 0)',
            deno: 'ifNull(toFloat64OrZero(toString(deno_osa)), 0)',
            qty: 'ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)',
            orders: 'ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)',
            mrpVal: 'ifNull(toFloat64OrZero(toString(MRP)), 0)',
            actualSales: 'ifNull(toFloat64OrZero(toString(Sales)), 0)',
            date: 'DATE',
            platform: 'Platform',
            brand: 'Brand',
            location: 'Location',
            category: PRODUCT_CATEGORY_SQL,
            compFlag: 'Comp_flag',
            compFlagMapping: 'Comp_flag',
            mrp: 'ifNull(toFloat64OrZero(toString(MRP)), 0)',
            sellingPrice: 'ifNull(toFloat64OrZero(toString(Selling_Price)), 0)',
            product: 'Product',
            skuCode: 'Web_Pid',
            quantitySold: 'Qty_Sold',
            discount: 'if(ifNull(toFloat64OrZero(toString(MRP)), 0) > 0, (ifNull(toFloat64OrZero(toString(MRP)), 0) - ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) / ifNull(toFloat64OrZero(toString(MRP)), 0) * 100, 0)',
            listingPercent: 'if(toFloat64OrZero(toString(listing_percent)) > 0, toFloat64OrZero(toString(listing_percent)), (ifNull(toFloat64OrZero(toString(neno_osa)), 0) / NULLIF(ifNull(toFloat64OrZero(toString(deno_osa)), 0), 0)) * 100)'
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
    if (v >= 100000) return `${(v / 100000).toFixed(2)} lac`;
    if (v >= 1000) return `${(v / 1000).toFixed(2)} K`;
    return Math.round(v).toLocaleString('en-IN');
};

// =====================================================
// IN-MEMORY CACHE FOR DISTINCT VALUES
// Reduces redundant database queries for lookup data
// =====================================================
const DISTINCT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const distinctValuesCache = {
    platforms: { data: null, timestamp: 0 },
    brands: new Map(), // key: platform, value: { data, timestamp }
    categories: new Map(), // key: platform, value: { data, timestamp }
    locations: new Map(), // key: platform, value: { data, timestamp }
    ourBrands: { data: null, timestamp: 0 }, // Global cache for our brands (Comp_flag=0)
};

/**
 * Get cached our brands list (Comp_flag=0) - Global module-level cache
 */
const getGlobalOurBrandsList = async () => {
    const cache = distinctValuesCache.ourBrands;
    if (cache.data && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        return cache.data;
    }

    try {
        const src = await getWatchtowerSource();
        // ClickHouse query
        const query = `SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table} WHERE toString(${src.f.compFlag}) = '0' AND ${src.f.brand} IS NOT NULL AND ${src.f.brand} != '' ORDER BY brand`;
        const results = await queryClickHouse(query);
        const result = results.map(b => b.brand).filter(b => b);
        distinctValuesCache.ourBrands = { data: result, timestamp: Date.now() };
        console.log(`[Global] Cached ${result.length} OUR brands (Comp_flag=0)`);
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
let cachedMaxDate = { date: null, timestamp: 0 };
const MAX_DATE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Helper to build platform condition based on channel selection
 * @param {string} platform - The selected platform (e.g. 'All', 'Blinkit')
 * @param {string} channel - The selected channel (e.g. 'Ecommerce', 'Modern Trades')
 * @returns {string|null} - The SQL condition for platform
 */
const buildPlatformChannelCond = (platform, channel, columnName = 'Platform', forceLower = false) => {
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
    const formatStr = (s) => forceLower && s ? s.toLowerCase() : s;

    if (platform && platform !== 'All') {
        const platforms = Array.isArray(platform) ? platform : (typeof platform === 'string' && platform.includes(',') ? platform.split(',') : [platform]);
        if (platforms.length === 1) {
            return `${columnName} = '${escapeStr(formatStr(platforms[0]))}'`;
        } else if (platforms.length > 1) {
            const list = platforms.map(p => `'${escapeStr(formatStr(p.trim()))}'`).join(', ');
            return `${columnName} IN (${list})`;
        }
    }

    if (channel === 'Ecommerce' || channel === 'E-commerce' || channel === 'Ecom') {
        const ecomPlatforms = ['Blinkit', 'Zepto', 'Instamart', 'Swiggy Instamart', 'Amazon', 'Flipkart'];
        return `${columnName} IN (${ecomPlatforms.map(p => `'${formatStr(p)}'`).join(', ')})`;
    }

    if (channel === 'Modern Trades' || channel === 'ModernTrade') {
        const ecomPlatforms = ['Blinkit', 'Zepto', 'Instamart', 'Swiggy Instamart', 'Amazon', 'Flipkart'];
        return `${columnName} NOT IN (${ecomPlatforms.map(p => `'${formatStr(p)}'`).join(', ')})`;
    }

    return null;
};

let cachedMaxDatePromise = null;

/**
 * Get the latest available date in rb_pdp_olap
 */
const getCachedMaxDate = async () => {
    if (cachedMaxDate.date && (Date.now() - cachedMaxDate.timestamp) < MAX_DATE_TTL) {
        return cachedMaxDate.date;
    }

    if (cachedMaxDatePromise) {
        return cachedMaxDatePromise;
    }

    cachedMaxDatePromise = (async () => {
        try {
            const src = await getWatchtowerSource();
            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const result = await queryClickHouse(`SELECT MAX(${dateCol}) as maxDate FROM ${src.table}`);
            const maxDateStr = result?.[0]?.maxDate;
            const maxDate = maxDateStr ? dayjs(maxDateStr).endOf('day') : dayjs().endOf('day');

            cachedMaxDate = { date: maxDate, timestamp: Date.now() };
            console.log(`🎯 [MaxDate] Latest available date detected and cached: ${maxDate.format('YYYY-MM-DD')}`);
            return maxDate;
        } catch (error) {
            console.error('Error fetching max date:', error);
            return dayjs().endOf('day'); // Fallback to today
        } finally {
            cachedMaxDatePromise = null;
        }
    })();

    return cachedMaxDatePromise;
};

// Cache for RcaSkuDim valid brand names (comp_flag=0)
let cachedValidBrandNames = { data: null, timestamp: 0 };
let cachedValidBrandNamesPromise = null;

/**
 * Get cached valid brand names from RcaSkuDim (comp_flag=0)
 * Used across multiple functions to avoid redundant DB queries
 */
const getCachedValidBrandNames = async () => {
    if (cachedValidBrandNames.data && (Date.now() - cachedValidBrandNames.timestamp) < DISTINCT_CACHE_TTL) {
        return cachedValidBrandNames.data;
    }

    if (cachedValidBrandNamesPromise) {
        return cachedValidBrandNamesPromise;
    }

    cachedValidBrandNamesPromise = (async () => {
        try {
            // ClickHouse query
            const query = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != '' ORDER BY brand_name`;
            const results = await queryClickHouse(query);
            const result = results.map(b => b.brand_name).filter(Boolean);
            cachedValidBrandNames = { data: result, timestamp: Date.now() };
            console.log(`⚡ [Cache] Cached ${result.length} valid brand names from RcaSkuDim`);
            return result;
        } catch (error) {
            console.error('Error fetching valid brand names:', error);
            return [];
        } finally {
            cachedValidBrandNamesPromise = null;
        }
    })();

    return cachedValidBrandNamesPromise;
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
    return `${sign}${val.toFixed(1)}${suffix}`;
};

/**
 * Shared Multi-unit currency formatter
 */
/**
 * Scales metrics for Mars-related entries if needed (100x scaling fix).
 * Data analysis shows financial/qty metrics for Mars brands are 100x inflated in source.
 */
const scaleMarsMetrics = (row, key) => {
    if (!row || !key) return row;
    const lowerKey = key.toLowerCase();
    const marsKeywords = ['snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m', 'orbit', 'doublemint', 'boomer', 'skittles', 'chocolates (gifting)', 'chocolates (non gifting)', 'gmfc'];

    const isMars = marsKeywords.some(kw => lowerKey.includes(kw));
    if (!isMars) return row;

    const fields = ['total_sales', 'total_qty', 'total_spend', 'total_ad_sales', 'total_ad_spend', 'total_ad_orders', 'total_ad_clicks', 'total_ad_impressions', 'my_mrp_val', 'my_actual_sales', 'comp_mrp_val', 'comp_actual_sales', 'cat_size', 'our_sales', 'sales', 'total_orders', 'orders', 'total_clicks', 'clicks', 'total_impressions', 'impressions', 'group_impressions', 'group_clicks', 'group_spends', 'group_orders', 'group_sales'];
    const scaled = { ...row };
    fields.forEach(f => {
        if (scaled[f] !== undefined && scaled[f] !== null) {
            scaled[f] = parseFloat(scaled[f]) * 0.01;
        }
    });
    return scaled;
};

const formatCurrency = (value) => {
    const val = parseFloat(value);
    if (isNaN(val)) return "₹0";
    if (val < 0.01 && val > -0.01) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} lac`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
    return `₹${val.toFixed(2)}`;
};

/**
 * Shared KPI column generator with change calculations
 */
const generateKpiColumns = ({
    offtake, availability, sos, marketShare, spend, roas, inorgSales, conversion, cpm, cpc, promoMyBrand = 0, promoCompete = 0, categorySize, adSov = 0, organicSov = 0,
    prevOfftake = 0, prevAvailability = 0, prevSos = 0, prevMarketShare = 0, prevSpend = 0, prevRoas = 0, prevInorgSales = 0, prevConversion = 0, prevCpm = 0, prevCpc = 0, prevPromoMyBrand = 0, prevPromoCompete = 0, prevCategorySize = 0, prevAdSov = 0, prevOrganicSov = 0,
    offtakeUnits = 0, inorgUnits = 0, prevOfftakeUnits = 0, prevInorgUnits = 0
}) => {
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
    const categorySizeChange = calcChange(categorySize, prevCategorySize);
    const adSovChange = calcPPChange(adSov, prevAdSov);
    const organicSovChange = calcPPChange(organicSov, prevOrganicSov);

    return [
        { title: "Offtakes", value: formatCurrency(offtake), change: { text: formatChange(offtakeChange), positive: offtakeChange >= 0 }, meta: { units: `${formatUnits(offtakeUnits)} units`, change: formatChange(offtakeChange) } },
        { title: "Category Size", value: formatCurrency(categorySize), change: { text: formatChange(categorySizeChange), positive: categorySizeChange >= 0 }, meta: { units: "market", change: formatChange(categorySizeChange) } },
        { title: "Spend", value: formatCurrency(spend), change: { text: formatChange(spendChange), positive: spendChange >= 0 }, meta: { units: "spend", change: formatChange(spendChange) } },
        { title: "ROAS", value: `${roas.toFixed(2)}x`, change: { text: formatChange(roasChange), positive: roasChange >= 0 }, meta: { units: "return", change: formatChange(roasChange) } },
        { title: "Inorg Sales", value: formatCurrency(inorgSales), change: { text: formatChange(inorgSalesChange), positive: inorgSalesChange >= 0 }, meta: { units: `${formatUnits(inorgUnits)} units`, change: formatChange(inorgSalesChange) } },
        { title: "Conversion", value: `${conversion.toFixed(1)}%`, change: { text: formatChange(conversionChange, true), positive: conversionChange >= 0 }, meta: { units: "Orders / Clicks", change: formatChange(conversionChange, true) } },
        { title: "Availability", value: `${availability.toFixed(1)}%`, change: { text: formatChange(availabilityChange, true), positive: availabilityChange >= 0 }, meta: { units: "stores", change: formatChange(availabilityChange, true) } },
        { title: "Share of Search", value: `${sos.toFixed(1)}%`, change: { text: formatChange(sosChange, true), positive: sosChange >= 0 }, meta: { units: "index", change: formatChange(sosChange, true) } },
        { title: "Ad SOV", value: `${adSov.toFixed(1)}%`, change: { text: formatChange(adSovChange, true), positive: adSovChange >= 0 }, meta: { units: "sponsored", change: formatChange(adSovChange, true) } },
        { title: "Organic SOV", value: `${organicSov.toFixed(1)}%`, change: { text: formatChange(organicSovChange, true), positive: organicSovChange >= 0 }, meta: { units: "organic", change: formatChange(organicSovChange, true) } },
        { title: "Market Share", value: `${(parseFloat(marketShare) || 0).toFixed(1)}%`, change: { text: formatChange(marketShareChange, true), positive: marketShareChange >= 0 }, meta: { units: "Category", change: formatChange(marketShareChange, true) } },
        { title: "Promo Compete", value: `${promoCompete.toFixed(1)}%`, change: { text: formatChange(promoCompeteChange, true), positive: promoCompeteChange >= 0 }, meta: { units: "Depth", change: formatChange(promoCompeteChange, true) } },
        { title: "CPM", value: `₹${cpm.toFixed(2)}`, change: { text: formatChange(cpmChange), positive: cpmChange >= 0 }, meta: { units: "impressions", change: formatChange(cpmChange) } },
        { title: "CPC", value: `₹${cpc.toFixed(2)}`, change: { text: formatChange(cpcChange), positive: cpcChange >= 0 }, meta: { units: "clicks", change: formatChange(cpcChange) } }
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
    const cache = distinctValuesCache.platforms;
    if (cache.data && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log('⚡ [Cache Hit] Distinct platforms from memory');
        return cache.data;
    }
    return null; // Cache miss
};

/**
 * Cache distinct platforms
 */
const cacheDistinctPlatforms = (data) => {
    distinctValuesCache.platforms = { data, timestamp: Date.now() };
    console.log(`📦 [Cache Set] Distinct platforms (${data.length} items)`);
};

/**
 * Get cached distinct brands for a platform
 */
const getCachedDistinctBrands = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = distinctValuesCache.brands.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit] Distinct brands for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct brands for a platform
 */
const cacheDistinctBrands = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    distinctValuesCache.brands.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set] Distinct brands for ${platform} (${data.length} items)`);
};

/**
 * Get cached distinct categories for a platform
 */
const getCachedDistinctCategories = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = distinctValuesCache.categories.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit] Distinct categories for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct categories for a platform
 */
const cacheDistinctCategories = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    distinctValuesCache.categories.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set] Distinct categories for ${platform} (${data.length} items)`);
};

/**
 * Get cached distinct locations for a platform
 */
const getCachedDistinctLocations = (platform) => {
    const key = (platform || 'all').toLowerCase();
    const cache = distinctValuesCache.locations.get(key);
    if (cache && (Date.now() - cache.timestamp) < DISTINCT_CACHE_TTL) {
        console.log(`⚡ [Cache Hit] Distinct locations for ${platform}`);
        return cache.data;
    }
    return null;
};

/**
 * Cache distinct locations for a platform
 */
const cacheDistinctLocations = (platform, data) => {
    const key = (platform || 'all').toLowerCase();
    distinctValuesCache.locations.set(key, { data, timestamp: Date.now() });
    console.log(`📦 [Cache Set] Distinct locations for ${platform} (${data.length} items)`);
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

        const { months = 1, startDate: qStartDate, endDate: qEndDate, compareStartDate: qCompareStartDate, compareEndDate: qCompareEndDate, channel } = filters;

        // Extract filter values - frontend may send as 'brand' or 'brand[]' (array format)
        const rawBrand = filters['brand[]'] || filters.brand;
        const rawLocation = filters['location[]'] || filters.location;
        const rawPlatform = filters['platform[]'] || filters.platform;
        const rawCategory = filters['category[]'] || filters.category;
        const rawSkuName = filters['skuName[]'] || filters.skuName;
        const rawSkuCode = filters['skuCode[]'] || filters.skuCode;

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
        const src = await getWatchtowerSource();

        // Helper for currency formatting
        const formatCurrency = (value) => {
            const val = parseFloat(value);
            if (isNaN(val)) return "0";

            // Return "0" for negligible amounts (less than 1 paisa)
            if (val < 0.01 && val > -0.01) return "0";

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

            const brandCol = src.f.brand;
            if (brandArr && brandArr.length > 0) {
                const brandConds = brandArr.map(b => `${brandCol} LIKE '%${escapeStrMain(b)}%'`).join(' OR ');
                if (brandConds) conditions.push(`(${brandConds})`);
            }

            const locationCol = src.f.location;
            const locationArrLocal = normalizeFilterArray(location);
            if (locationArrLocal && locationArrLocal.length > 0) {
                const locCond = `lower(${locationCol}) IN (${locationArrLocal.map(l => `'${escapeStrMain(l.toLowerCase())}'`).join(', ')})`;
                console.log('[DEBUG] Location Array:', locationArrLocal, 'Condition:', locCond);
                conditions.push(locCond);
            }

            const platformCol = src.f.platform;
            const platformArrLocal = normalizeFilterArray(platform);
            if (platformArrLocal && platformArrLocal.length > 0) {
                const cond = buildPlatformChannelCond(platformArrLocal, channel, `lower(${platformCol})`, true);
                if (cond) conditions.push(cond);
            } else {
                // If platform is 'All' or null, handle based on channel
                const cond = buildPlatformChannelCond(null, channel, `lower(${platformCol})`, true);
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
                const cond = buildPlatformChannelCond(platformFilterArr, channel, `lower(${platformCol})`, true);
                if (cond) conditions.push(cond);
            } else {
                // If platform is 'All' or null, handle based on channel
                const cond = buildPlatformChannelCond(null, channel, `lower(${platformCol})`, true);
                if (cond) conditions.push(cond);
            }

            // Handle location with multi-value support
            const locationFilterArr = normalizeFilterArray(locationFilter);
            if (locationFilterArr && locationFilterArr.length > 0) {
                conditions.push(`lower(${src.f.location}) IN (${locationFilterArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
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
                return totalDeno > 0 ? (totalNeno / totalDeno) * 100 : 0;
            } catch (error) {
                console.error('[getAvailability] ClickHouse error:', error.message);
                return 0;
            }
        };

        // Share of Search Calculation Helper - NOW USES CLICKHOUSE
        // Formula: Overall SOS = COUNT(overall=1) / COUNT(*) for selected filters × 100
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

                // For brand filter: filter by flag=0 (our brands) or by specific brand name
                const brandArr = normalizeFilterArray(brandFilter);
                let numCondition = 'toInt32(overall) = 1';

                if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
                    const brandConds = brandArr.map(b => `lower(brand_name_th) LIKE lower('%${escapeStr(b)}%')`).join(' OR ');
                    numCondition += ` AND (${brandConds})`;
                } else {
                    // When brand is "All", filter for our brands using flag=1
                    numCondition += ` AND toString(flag) = '1'`;
                }

                // Simple SOS: COUNT(overall=1) / COUNT(*) × 100
                const sql = `
                    SELECT 
                        countIf(${numCondition}) as num,
                        count() as den
                    FROM rb_kw_olap
                    WHERE ${baseConditions.join(' AND ')}
                `;

                const result = await queryClickHouse(sql);
                const num = parseInt(result[0]?.num || 0);
                const den = parseInt(result[0]?.den || 0);

                return den > 0 ? (num / den) * 100 : 0;
            } catch (error) {
                console.error("Error calculating Share of Search:", error);
                return 0;
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
                if (validBrands.length === 0) return new Map();

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
                    const brandClause = validBrands.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ');

                    // Simple SOS per brand: countIf(overall=1) / count() per brand
                    const sql = `
                        SELECT 
                            lower(brand_name_th) as brand,
                            countIf(toInt32(overall) = 1) as num,
                            count() as den
                        FROM rb_kw_olap
                        WHERE ${baseConds.join(' AND ')}
                        AND lower(brand_name_th) IN (${brandClause})
                        GROUP BY brand
                    `;
                    return queryClickHouse(sql);
                };

                const [currResult, prevResult] = await Promise.all([
                    executeSOSQuery(currStart, currEnd),
                    executeSOSQuery(prevStart, prevEnd)
                ]);

                const currMap = new Map(currResult.map(r => [r.brand, r.den > 0 ? (r.num / r.den) * 100 : 0]));
                const prevMap = new Map(prevResult.map(r => [r.brand, r.den > 0 ? (r.num / r.den) * 100 : 0]));

                const sosMap = new Map();
                validBrands.forEach(brand => {
                    const key = brand.toLowerCase();
                    sosMap.set(brand, {
                        current: currMap.get(key) || 0,
                        previous: prevMap.get(key) || 0
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
                const { brand, location, category, skuName, skuCode, channel } = filters;

                // Helper to escape strings for ClickHouse
                const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';



                // Build WHERE conditions for ClickHouse
                const buildConditions = (dateStart, dateEnd) => {
                    const dateCol = src.isAgg ? 'date' : 'DATE';
                    const conditions = [`${dateCol} BETWEEN '${dateStart}' AND '${dateEnd}'`];

                    const brandCol = src.isAgg ? 'brand' : 'Brand';
                    const brandCondArr = normalizeFilterArray(brand);
                    if (brandCondArr && brandCondArr.length > 0) {
                        const brandConds = brandCondArr.map(b => `${brandCol} LIKE '%${escapeStr(b)}%'`).join(' OR ');
                        conditions.push(`(${brandConds})`);
                    }

                    const locCol = src.isAgg ? 'location' : 'Location';
                    const locationArr = normalizeFilterArray(location);
                    if (locationArr && locationArr.length > 0) {
                        conditions.push(`${locCol} IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                    }

                    // Channel-based platform filtering
                    const platformCol = src.isAgg ? 'platform' : 'Platform';
                    const platformCond = buildPlatformChannelCond(null, channel, platformCol);
                    if (platformCond) {
                        conditions.push(platformCond);
                    }

                    // Apply Product_Category filter
                    const catArrLocal = normalizeFilterArray(category);
                    if (catArrLocal && catArrLocal.length > 0) {
                        conditions.push(`${src.f.category} IN (${catArrLocal.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                    }

                    // Advanced SKU Search Filters (Only supported on raw table)
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
                    }
                    return conditions.join(' AND ');
                };

                const currConditions = buildConditions(currStart.format('YYYY-MM-DD'), currEnd.format('YYYY-MM-DD'), false);
                const prevConditions = buildConditions(prevStart.format('YYYY-MM-DD'), prevEnd.format('YYYY-MM-DD'), false);
                const currPmConditions = buildConditions(currStart.format('YYYY-MM-DD'), currEnd.format('YYYY-MM-DD'), true);
                const prevPmConditions = buildConditions(prevStart.format('YYYY-MM-DD'), prevEnd.format('YYYY-MM-DD'), true);

                // Execute queries in parallel using ClickHouse
                const [currData, currMs, currPmData, prevData, prevMs, prevPmData] = await Promise.all([
                    // Query 1: Current period offtake metrics for all platforms
                    queryClickHouse(`
                        SELECT 
                            ${src.f.platform} as Platform,
                            SUM(${src.f.sales}) as sales,
                            SUM(${src.f.spend}) as spend,
                            SUM(${src.f.adSales}) as ad_sales,
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
                            if (locArr.length === 1) {
                                msConds.push(`location = '${escapeStr(locArr[0])}'`);
                            } else {
                                msConds.push(`location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                            }
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
                            Platform,
                            SUM(ad_spend) as spend,
                            SUM(ad_sales) as ad_sales,
                            SUM(ad_click) as clicks,
                            SUM(impressions) as impressions,
                            SUM(ad_quantity_sold) as orders
                        FROM mars.rca_pm_olap
                        WHERE ${currPmConditions}
                        GROUP BY Platform
                    `),
                    // Query 4: Previous period offtake metrics for all platforms
                    queryClickHouse(`
                        SELECT 
                            ${src.f.platform} as Platform,
                            SUM(${src.f.sales}) as sales,
                            SUM(${src.f.spend}) as spend,
                            SUM(${src.f.adSales}) as ad_sales,
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
                            if (locArr.length === 1) {
                                msConds.push(`location = '${escapeStr(locArr[0])}'`);
                            } else {
                                msConds.push(`location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                            }
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
                            Platform,
                            SUM(ad_spend) as spend,
                            SUM(ad_sales) as ad_sales,
                            SUM(ad_click) as clicks,
                            SUM(impressions) as impressions,
                            SUM(ad_quantity_sold) as orders
                        FROM mars.rca_pm_olap
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
                            adSales: parseFloat(cPm?.ad_sales || 0),
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
                            adSales: parseFloat(pvPm?.ad_sales || 0),
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
            offtakeData,
            marketShareData,
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
            (async () => {
                try {
                    const result = await queryClickHouse(`SELECT SUM(${src.f.sales}) as total_sales FROM ${src.table} WHERE ${offtakeCondStr}`);
                    return [{ total_sales: result[0]?.total_sales || 0 }];
                } catch (err) {
                    console.error('[Offtake] ClickHouse error:', err.message);
                    return [{ total_sales: 0 }];
                }
            })(),
            // 2. Market Share - USING marketShareHelper
            (async () => {
                return [];
            })(),
            // 3. Total Market Share Average - USING marketShareHelper
            (async () => {
                try {
                    const avgMs = await getMarketShare(startDate, endDate, platformArr, categoryArr, brandArr, locationArr);
                    return { avg_market_share: avgMs, count: 1, min_val: avgMs, max_val: avgMs };
                } catch (err) {
                    console.error('[TotalMarketShare] helper error:', err.message);
                    return { avg_market_share: 0, count: 0, min_val: 0, max_val: 0 };
                }
            })(),
            // 4. Top SKUs - USING CLICKHOUSE (simplified without join)
            (async () => {
                try {
                    const result = await queryClickHouse(`
                        SELECT 
                            ${src.f.product} as sku_name,
                            SUM(${src.f.sales}) as sku_gmv
                        FROM ${src.table}
                        WHERE ${offtakeCondStr} AND ${src.f.product} IS NOT NULL AND ${src.f.product} != ''
                        GROUP BY sku_name
                        ORDER BY sku_gmv DESC
                        LIMIT 10
                    `);
                    return result;
                } catch (error) {
                    console.error('Error fetching top SKUs:', error.message);
                    return [];
                }
            })(),
            // 5. Current Availability (already uses ClickHouse)
            getAvailability(startDate, endDate, brand, platform, location, category, skuName, skuCode),
            // 6. Previous Availability
            getAvailability(momStartDate, momEndDate, brand, platform, location, category, skuName, skuCode),
            // 7. Current Share of Search (already uses ClickHouse)
            getShareOfSearch(startDate, endDate, brand, platform, location, category),
            // 8. Previous Share of Search
            getShareOfSearch(momStartDate, momEndDate, brand, platform, location, category),
            // 9. Availability Trend Data - USING CLICKHOUSE
            (async () => {
                return [];
            })(),
            // 10. Share of Search Trend Data - USING CLICKHOUSE
            (async () => {
                return [];
            })(),
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
            // 12. Previous Market Share - USING marketShareHelper
            (async () => {
                try {
                    const avgMs = await getMarketShare(momStartDate, momEndDate, platformArr, categoryArr, brandArr, locationArr);
                    return { avg_ms: avgMs };
                } catch (err) {
                    console.error('[PrevMarketShare] helper error:', err.message);
                    return { avg_ms: 0 };
                }
            })(),
            (async () => {
                try {
                    const result = await queryClickHouse(`
                        SELECT AVG(if(${src.f.mrp} > 0, (${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp}, 0)) * 100 as avg_promo
                        FROM ${src.table}
                        WHERE ${offtakeCondStr} AND ${src.f.compFlag} = '0'
                    `);
                    return parseFloat(result[0]?.avg_promo || 0);
                } catch (err) {
                    console.error('[PromoDepth] ClickHouse error:', err.message);
                    return 0;
                }
            })(),
            // 14. Previous Promo Depth - CLICKHOUSE
            (async () => {
                try {
                    const prevOfftakeCondStr = buildOfftakeConditions(momStartDate, momEndDate);
                    const result = await queryClickHouse(`
                        SELECT AVG(if(${src.f.mrp} > 0, (${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp}, 0)) * 100 as avg_promo
                        FROM ${src.table}
                        WHERE ${prevOfftakeCondStr} AND ${src.f.compFlag} = '0'
                    `);
                    return parseFloat(result[0]?.avg_promo || 0);
                } catch (err) {
                    console.error('[PrevPromoDepth] ClickHouse error:', err.message);
                    return 0;
                }
            })(),
            // 15. Promo Trend Data - CLICKHOUSE
            (async () => {
                return [];
            })()
        ]);

        // Process Offtake Data - Using weekBuckets for weekly chart
        const offtakeChart = [];

        const totalOfftake = offtakeData.reduce((sum, d) => sum + parseFloat(d.total_sales), 0);
        const formattedOfftake = formatCurrency(totalOfftake);

        // Calculate Offtake Trend
        const prevOfftakeVal = parseFloat(prevOfftakeResult || 0);
        let offtakeChange = 0;
        if (prevOfftakeVal > 0) {
            offtakeChange = ((totalOfftake - prevOfftakeVal) / prevOfftakeVal) * 100;
        } else if (totalOfftake > 0) {
            offtakeChange = 100; // Treat as 100% growth if previous was 0 and current is > 0
        }
        const offtakeTrendStr = (offtakeChange >= 0 ? "+" : "") + offtakeChange.toFixed(1) + "%";

        // Process Market Share Data - Using weekBuckets for weekly chart
        const marketShareChart = [];

        // Hardcode overall Market Share removed, now using calculation
        const totalMarketShare = parseFloat(totalMarketShareResult?.avg_market_share || 0);
        const formattedMarketShare = totalMarketShare.toFixed(1) + "%";

        // Calculate Market Share Trend (percentage point difference for % KPIs)
        const prevMarketShareVal = parseFloat(prevMarketShareResult?.avg_ms || 0);
        const marketShareChange = totalMarketShare - prevMarketShareVal;
        const marketShareTrendStr = (marketShareChange >= 0 ? "+" : "") + marketShareChange.toFixed(1) + "%";

        // Process Availability Data
        const formattedAvailability = currentAvailability.toFixed(1) + "%";

        // Calculate Availability Trend (percentage point difference for % KPIs)
        const availabilityChange = currentAvailability - prevAvailability;
        const availabilityTrendStr = (availabilityChange >= 0 ? "+" : "") + availabilityChange.toFixed(1) + "%";

        // Process Availability Chart - Using weekBuckets for weekly chart
        const availabilityChart = [];

        // Process Share of Search Data
        const formattedShareOfSearch = currentShareOfSearch.toFixed(1) + "%";

        // Calculate SOS Trend (percentage point difference for % KPIs)
        const sosChange = currentShareOfSearch - prevShareOfSearch;
        const sosTrendStr = (sosChange >= 0 ? "+" : "") + sosChange.toFixed(1) + "%";

        // Process Share of Search Chart - Using weekBuckets for weekly chart
        const shareOfSearchChart = [];

        // Process Promo Data (with safe defaults to prevent crash)
        const safePromoDepth = parseFloat(currentPromoDepth) || 0;
        const safePrevPromoDepth = parseFloat(prevPromoDepth) || 0;
        const formattedPromo = safePromoDepth.toFixed(1) + "%";
        const promoChange = safePromoDepth - safePrevPromoDepth;
        const promoTrendStr = (promoChange >= 0 ? "+" : "") + promoChange.toFixed(1) + "%";

        const safePromoTrendData = Array.isArray(promoTrendData) ? promoTrendData : [];
        const promoChart = [];

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

        // Prepare Top Metrics Array (Cards with Charts) - Use weekBuckets for weekly labels
        const chartLabels = weekBuckets.map(b => b.label);

        // Determine subtitle based on filters
        let subtitle = `last ${monthsBack} months`;
        if (qStartDate && qEndDate) {
            subtitle = `${dayjs(qStartDate).format('DD MMM')} - ${dayjs(qEndDate).format('DD MMM')}`;
        }

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
                chart: offtakeChart,
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
                chart: availabilityChart,
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
                chart: shareOfSearchChart,
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
                chart: marketShareChart,
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
                chart: promoChart,
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
                    const { brand, platform, location, channel, category } = filters;
                    const escapeStrLocal = (str) => str ? str.replace(/'/g, "''") : '';

                    const conditions = [
                        `DATE BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`
                    ];

                    const platArr = normalizeFilterArray(platform);
                    if (platArr && platArr.length > 0) {
                        conditions.push(`${src.f.platform} IN (${platArr.map(p => `'${escapeStrLocal(p)}'`).join(', ')})`);
                    } else {
                        const platformCond = buildPlatformChannelCond(null, channel, src.f.platform);
                        if (platformCond) conditions.push(platformCond);
                    }

                    const brandArrLocal = normalizeFilterArray(brand);
                    if (brandArrLocal && brandArrLocal.length > 0) {
                        const brandConds = brandArrLocal.map(b => `'${escapeStrLocal(b).toLowerCase()}'`).join(',');
                        conditions.push(`lower(category) IN (${brandConds})`);
                    }

                    const catArrLocal = normalizeFilterArray(category);
                    if (catArrLocal && catArrLocal.length > 0) {
                        const catConds = catArrLocal.map(c => `'${escapeStrLocal(c)}'`).join(',');
                        conditions.push(`category IN (${catConds})`);
                    }

                    const query = `
                        SELECT 
                            0 as sales,
                            SUM(ad_sales) as adSales,
                            SUM(ad_quantity_sold) as orders,
                            SUM(ad_click) as clicks,
                            SUM(impressions) as impressions,
                            SUM(ad_spend) as spend
                        FROM mars.rca_pm_olap
                        WHERE ${conditions.join(' AND ')}
                    `;

                    try {
                        const results = await queryClickHouse(query);
                        return {
                            sales: parseFloat(results[0]?.sales || 0),
                            adSales: parseFloat(results[0]?.adSales || 0),
                            orders: parseFloat(results[0]?.orders || 0),
                            clicks: parseFloat(results[0]?.clicks || 0),
                            impressions: parseFloat(results[0]?.impressions || 0),
                            spend: parseFloat(results[0]?.spend || 0)
                        };
                    } catch (error) {
                        console.error('[getPrecisePerformanceMetrics] Error:', error.message);
                        return { sales: 0, adSales: 0, orders: 0, clicks: 0, impressions: 0, spend: 0 };
                    }
                };

                // ⚡ MEGA OPTIMIZATION: Pre-computed monthly KPI cache with Redis fallback
                const getBulkPerformanceMetrics = async (startRange, endRange, filters) => {
                    const { brand, platform, location, channel, category } = filters;

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
                    const conditions = [
                        `DATE BETWEEN '${startRange.format('YYYY-MM-DD')}' AND '${endRange.format('YYYY-MM-DD')}'`
                    ];

                    // Add platform filter (multi-value support)
                    const platArr = normalizeFilterArray(platform);
                    if (platArr && platArr.length > 0) {
                        conditions.push(`Platform IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                    } else {
                        // Handle All platform based on channel
                        const platformCond = buildPlatformChannelCond(null, channel);
                        if (platformCond) {
                            conditions.push(platformCond);
                        }

                        // Add platform filter (multi-value support)
                        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
                        const platCol = src.f.platform;
                        const brandCol = src.f.brand;

                        const platArr = normalizeFilterArray(platform);
                        if (platArr && platArr.length > 0) {
                            conditions.push(`${platCol} IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                        } else {
                            // Handle All platform based on channel
                            const platformCond = buildPlatformChannelCond(null, channel, platCol);
                            if (platformCond) {
                                conditions.push(platformCond);
                            }
                        }

                        // Add brand filter (multi-value support with LIKE)
                        const brandArrLocal = normalizeFilterArray(brand);
                        if (brandArrLocal && brandArrLocal.length > 0) {
                            const brandConds = brandArrLocal.map(b => `${brandCol} LIKE '%${escapeStr(b)}%'`).join(' OR ');
                            conditions.push(`(${brandConds})`);
                        }

                        const results = await queryClickHouse(`
                            SELECT 
                                formatDateTime(${dateCol}, '%Y-%m-01') as month,
                                SUM(${src.f.sales}) as total_sales,
                                SUM(${src.f.adSales}) as total_ad_sales,
                                SUM(${src.f.orders}) as total_orders,
                                SUM(${src.f.clicks}) as total_clicks,
                                SUM(${src.f.impressions}) as total_impressions,
                                SUM(${src.f.spend}) as total_spend
                            FROM ${src.table}
                            WHERE ${conditions.join(' AND ')}
                            GROUP BY month
                            ORDER BY month ASC
                        `);

                        results.forEach(row => {
                            dataByMonth.set(row.month, {
                                sales: parseFloat(row.total_sales || 0),
                                adSales: parseFloat(row.total_ad_sales || 0),
                                orders: parseFloat(row.total_orders || 0),
                                clicks: parseFloat(row.total_clicks || 0),
                                impressions: parseFloat(row.total_impressions || 0),
                                spend: parseFloat(row.total_spend || 0)
                            });
                        });
                    }

                    // Add brand filter (mapped to category for mars.rca_pm_olap)
                    const brandArrLocal = normalizeFilterArray(brand);
                    if (brandArrLocal && brandArrLocal.length > 0) {
                        const brandConds = brandArrLocal.map(b => `'${escapeStr(b).toLowerCase()}'`).join(',');
                        conditions.push(`lower(category) IN (${brandConds})`);
                    }

                    const catArrLocal = normalizeFilterArray(category);
                    if (catArrLocal && catArrLocal.length > 0) {
                        const catConds = catArrLocal.map(c => `'${escapeStr(c)}'`).join(',');
                        conditions.push(`category IN (${catConds})`);
                    }

                    const results = await queryClickHouse(`
                        SELECT 
                            formatDateTime(DATE, '%Y-%m-01') as month,
                            0 as total_sales,
                            SUM(ad_sales) as total_ad_sales,
                            SUM(ad_quantity_sold) as total_orders,
                            SUM(ad_click) as total_clicks,
                            SUM(impressions) as total_impressions,
                            SUM(ad_spend) as total_spend
                        FROM mars.rca_pm_olap
                        WHERE ${conditions.join(' AND ')}
                        GROUP BY formatDateTime(DATE, '%Y-%m-01')
                        ORDER BY month ASC
                    `);

                    results.forEach(row => {
                        dataByMonth.set(row.month, {
                            sales: parseFloat(row.total_sales || 0),
                            adSales: parseFloat(row.total_ad_sales || 0),
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
                        sales: 0, adSales: 0, orders: 0, clicks: 0, impressions: 0, spend: 0
                    };

                    // Iterate through all months in the range and sum the values
                    let current = start.clone().startOf('month');
                    const endMonth = end.clone().endOf('month');

                    while (current.isBefore(endMonth) || current.isSame(endMonth, 'month')) {
                        const monthKey = current.format('YYYY-MM-01');
                        const monthData = bulkData.get(monthKey);

                        if (monthData) {
                            result.sales += monthData.sales || 0;
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
                    return data.adSales; // sum(Ad_Sales) - absolute value
                };

                const calculateConversion = (data) => {
                    return data.clicks > 0 ? (data.orders / data.clicks) * 100 : 0; // Orders / Clicks * 100
                };

                const calculateRoas = (data) => {
                    return data.spend > 0 ? data.adSales / data.spend : 0;
                };

                const calculateBmi = (data) => {
                    return data.sales > 0 ? (data.spend / data.sales) * 100 : 0;
                };

                // Extract data for current and MoM periods using precise fetch for exact date range accuracy
                const [currentData, momData] = await Promise.all([
                    getPrecisePerformanceMetrics(startDate, endDate, { brand, platform, location, channel, category: filters.category }),
                    getPrecisePerformanceMetrics(momStartDate, momEndDate, { brand, platform, location, channel, category: filters.category })
                ]);

                // Calculate trend data for all KPIs from bulk results
                const inorgTrendData = last7Months.map(m => calculateInorganicSales(getDataForRange(m.start, m.end)));
                const convTrendData = last7Months.map(m => calculateConversion(getDataForRange(m.start, m.end)));
                const roasTrendData = last7Months.map(m => calculateRoas(getDataForRange(m.start, m.end)));
                const bmiTrendData = last7Months.map(m => calculateBmi(getDataForRange(m.start, m.end)));

                // Calculate current and MoM values for each KPI
                const currentInorg = calculateInorganicSales(currentData);
                const momInorg = calculateInorganicSales(momData);
                const inorgChange = momInorg > 0 ? ((currentInorg - momInorg) / momInorg) * 100 : (currentInorg > 0 ? 100 : 0);

                const currentConv = calculateConversion(currentData);
                const momConv = calculateConversion(momData);
                const convChange = momConv > 0 ? ((currentConv - momConv) / momConv) * 100 : (currentConv > 0 ? 100 : 0);

                const currentRoas = calculateRoas(currentData);
                const momRoas = calculateRoas(momData);
                const roasChange = momRoas > 0 ? ((currentRoas - momRoas) / momRoas) * 100 : (currentRoas > 0 ? 100 : 0);

                const currentOrders = currentData.orders || 0;
                const momOrders = momData.orders || 0;
                const ordersChange = momOrders > 0 ? ((currentOrders - momOrders) / momOrders) * 100 : (currentOrders > 0 ? 100 : 0);

                const currentBmi = calculateBmi(currentData);
                const momBmi = calculateBmi(momData);
                const bmiChange = momBmi > 0 ? ((currentBmi - momBmi) / momBmi) * 100 : (currentBmi > 0 ? 100 : 0);

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
                        sosNumConds.push(`brand_name_th IN (${brandArrLocal.map(b => `'${sosEscapeStr(b)}'`).join(', ')})`);
                    } else {
                        sosNumConds.push(`toString(flag) = '1'`);
                    }

                    // 2 queries: numerator uses countIf(overall=1), denominator uses count()
                    const [sosNumByMonth, sosDenomByMonth] = await Promise.all([
                        queryClickHouse(`
                            SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month, countIf(toInt32(overall) = 1) as count
                            FROM rb_kw_olap WHERE ${sosNumConds.join(' AND ')}
                            GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                        `),
                        queryClickHouse(`
                            SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month, count() as count
                            FROM rb_kw_olap WHERE ${sosBaseConds.join(' AND ')}
                            GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                        `)
                    ]);

                    const sosNumMap = new Map(sosNumByMonth.map(r => [r.month, parseInt(r.count)]));
                    const sosDenomMap = new Map(sosDenomByMonth.map(r => [r.month, parseInt(r.count)]));

                    sosTrendKpiData = last7Months.map(m => {
                        const monthKey = m.start.format('YYYY-MM-01');
                        const num = sosNumMap.get(monthKey) || 0;
                        const denom = sosDenomMap.get(monthKey) || 0;
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
                        const data = osaMap.get(monthKey) || { neno: 0, deno: 0 };
                        return data.deno > 0 ? (data.neno / data.deno) * 100 : 0;
                    });

                    console.log(`[OSA Trend] OPTIMIZED: Fetched 7 months with 1 bulk query`);
                } catch (err) {
                    console.error('[OSA Trend] Error:', err.message);
                    osaTrendData = Array(7).fill(0);
                }

                let osaStatus = "stable";
                if (osaAbsChange > 1) osaStatus = "improving";
                else if (osaAbsChange < -1) osaStatus = "declining";

                // Build KPI cards
                // 1. Share of Search
                performanceMetricsKpis.push({
                    id: "sos_new",
                    label: "SHARE OF SEARCH",
                    value: `${currentSosKpi.toFixed(1)}%`,
                    prevValue: `${momSosKpi.toFixed(1)}%`,
                    unit: "",
                    tag: `${sosKpiChange >= 0 ? '+' : ''}${sosKpiChange.toFixed(1)}%`,
                    tagTone: sosKpiChange >= 0 ? "positive" : "warning",
                    footer: "Organic + Paid view",
                    trendTitle: "Share of Search Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: sosTrendKpiData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 2. Inorganic Sales
                performanceMetricsKpis.push({
                    id: "inorganic",
                    label: "INORGANIC SALES",
                    value: formatCurrency(currentInorg),
                    prevValue: formatCurrency(momInorg),
                    unit: "",
                    tag: `${inorgChange >= 0 ? '+' : ''}${inorgChange.toFixed(1)}%`,
                    tagTone: inorgChange >= 0 ? "positive" : "warning",
                    footer: "sum(Ad_Sales)",
                    trendTitle: "Inorganic Sales Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: inorgTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 3. Conversion
                performanceMetricsKpis.push({
                    id: "conversion",
                    label: "CONVERSION",
                    value: currentConv.toFixed(1),
                    prevValue: momConv.toFixed(1),
                    unit: "",
                    tag: `${convChange >= 0 ? '+' : ''}${convChange.toFixed(1)}%`,
                    tagTone: convChange >= 0 ? "positive" : "warning",
                    footer: "Orders / Clicks",
                    trendTitle: "Conversion Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: convTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 4. ROAS
                performanceMetricsKpis.push({
                    id: "roas_new",
                    label: "ROAS",
                    value: currentRoas.toFixed(1),
                    prevValue: momRoas.toFixed(1),
                    unit: "",
                    tag: `${roasChange >= 0 ? '+' : ''}${roasChange.toFixed(1)}%`,
                    tagTone: roasChange >= 0 ? "positive" : "warning",
                    footer: "Return on Ad Spend",
                    trendTitle: "ROAS Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: roasTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
                });

                // 5. Orders (Using actual 'orders' property calculated from Ad_Quanity_sold previously)
                const ordersTrendData = last7Months.map(m => getDataForRange(m.start, m.end).orders);
                const formatter = Intl.NumberFormat('en', { notation: 'compact' });
                performanceMetricsKpis.push({
                    id: "orders",
                    label: "ORDERS",
                    value: currentOrders >= 1000 ? formatter.format(currentOrders) : currentOrders.toString(),
                    prevValue: momOrders >= 1000 ? formatter.format(momOrders) : momOrders.toString(),
                    unit: "",
                    tag: `${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}%`,
                    tagTone: ordersChange >= 0 ? "positive" : "warning",
                    footer: "Ad Quantity Sold",
                    trendTitle: "Orders Trend",
                    trendSubtitle: "Last 7 periods",
                    trendData: ordersTrendData.map((val, idx) => ({ period: last7Months[idx].label, value: val }))
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
            const qCommercePlatforms = ['zepto', 'blinkit', 'swiggy instamart', 'dunzo'];
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
            const suffix = isPercentagePoint ? '%' : '%';
            const sign = changeValue >= 0 ? '+' : '';
            return `${sign}${changeValue.toFixed(1)}${suffix}`;
        };

        // Helper to generate columns structure with MoM changes
        const generateColumns = (
            // Current period values
            offtake, availability, sos, marketShare = 0, spend = 0, roas = 0, inorgSales = 0,
            conversion = 0, cpm = 0, cpc = 0, promoMyBrand = 0, promoCompete = 0,
            // Previous period values (for MoM calculation)
            prevOfftake = 0, prevAvailability = 0, prevSos = 0, prevMarketShare = 0,
            prevSpend = 0, prevRoas = 0, prevInorgSales = 0, prevConversion = 0,
            prevCpm = 0, prevCpc = 0, prevPromoMyBrand = 0, prevPromoCompete = 0
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
                    meta: { units: "sum(Ad_Sales)", change: formatChange(inorgSalesChange) }
                },
                {
                    title: "Conversion",
                    value: `${conversion.toFixed(1)}%`,
                    change: { text: formatChange(conversionChange, true), positive: conversionChange >= 0 },
                    meta: { units: "Orders / Clicks", change: formatChange(conversionChange, true) }
                },
                {
                    title: "Availability",
                    value: `${availability.toFixed(1)}%`,
                    change: { text: formatChange(availabilityChange, true), positive: availabilityChange >= 0 },
                    meta: { units: "stores", change: formatChange(availabilityChange, true) }
                },
                {
                    title: "SOS",
                    value: `${sos.toFixed(1)}%`,
                    change: { text: formatChange(sosChange, true), positive: sosChange >= 0 },
                    meta: { units: "index", change: formatChange(sosChange, true) }
                },
                {
                    title: "Market Share",
                    value: `${(parseFloat(marketShare) || 0).toFixed(1)}%`,
                    change: { text: formatChange(marketShareChange, true), positive: marketShareChange >= 0 },
                    meta: { units: "Category", change: formatChange(marketShareChange, true) }
                },
                {
                    title: "Promo Compete",
                    value: `${promoCompete.toFixed(1)}%`,
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
                    SELECT avg(if(${s.f.mrp} > 0, 
                        (${s.f.mrp} - ${s.f.sellingPrice}) / ${s.f.mrp}, 0)) as avg_depth
                    FROM ${s.table}
                    WHERE ${conds.join(' AND ')}
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
            const buildAllConditionsLocal = (startDt, endDt, s) => {
                const dateCol = s.isAgg ? 'date' : 'toDate(DATE)';
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
                }
                // Apply Product_Category filter
                const catArrLocal = normalizeFilterArray(filters.category);
                if (catArrLocal && catArrLocal.length > 0) {
                    conditions.push(`${s.f.category} IN (${catArrLocal.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                }

                // Apply channel-based platform filter (matching Watch Tower Overview logic)
                if (platformArr && platformArr.length > 0) {
                    const cond = buildPlatformChannelCond(platformArr, channel, s.f.platform);
                    if (cond) conditions.push(cond);
                } else {
                    const cond = buildPlatformChannelCond(null, channel, s.f.platform);
                    if (cond) conditions.push(cond);
                }

                return conditions.join(' AND ');
            };

            const currConditions = buildAllConditionsLocal(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), src);
            const prevConditions = buildAllConditionsLocal(allMomStart.format('YYYY-MM-DD'), allMomEnd.format('YYYY-MM-DD'), src);

            // Fetch current and previous period metrics in parallel using ClickHouse
            const [allMetricsResult, prevAllMetricsResult, allPmMetricsResult, prevAllPmMetricsResult] = await Promise.all([
                queryClickHouse(`
                    SELECT 
                        SUM(${src.f.sales}) as total_sales,
                        SUM(${src.f.spend}) as total_spend,
                        SUM(${src.f.adSales}) as total_ad_sales,
                        SUM(${src.f.clicks}) as total_clicks,
                        SUM(${src.f.impressions}) as total_impressions
                    FROM ${src.table}
                    WHERE ${currConditions}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(${src.f.sales}) as total_sales,
                        SUM(${src.f.spend}) as total_spend,
                        SUM(${src.f.adSales}) as total_ad_sales,
                        SUM(${src.f.clicks}) as total_clicks,
                        SUM(${src.f.impressions}) as total_impressions
                    FROM ${src.table}
                    WHERE ${prevConditions}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(ad_spend) as total_spend,
                        SUM(ad_sales) as total_ad_sales,
                        SUM(ad_click) as total_clicks,
                        SUM(impressions) as total_impressions,
                        SUM(ad_quantity_sold) as total_orders
                    FROM mars.rca_pm_olap
                    WHERE ${currPmConditions}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(ad_spend) as total_spend,
                        SUM(ad_sales) as total_ad_sales,
                        SUM(ad_click) as total_clicks,
                        SUM(impressions) as total_impressions,
                        SUM(ad_quantity_sold) as total_orders
                    FROM mars.rca_pm_olap
                    WHERE ${prevPmConditions}
                `)
            ]);

            // Current period values (ClickHouse returns array)
            const currMetrics = allMetricsResult[0] || {};
            const currPmMetrics = allPmMetricsResult[0] || {};
            allOfftake = parseFloat(currMetrics.total_sales || 0);
            allSpend = parseFloat(currPmMetrics.total_spend || 0);
            allAdSales = parseFloat(currPmMetrics.total_ad_sales || 0);
            const allClicks = parseFloat(currPmMetrics.total_clicks || 0);
            const allImpressions = parseFloat(currPmMetrics.total_impressions || 0);
            const allOrders = parseFloat(currPmMetrics.total_orders || 0);

            console.log("ALL COLUMN OFFTAKE VALUES:", {
                allOfftake, currMetrics_totalSales: currMetrics.total_sales, currConditions
            });

            // Previous period values (ClickHouse returns array)
            const prevMetrics = prevAllMetricsResult[0] || {};
            const prevPmMetrics = prevAllPmMetricsResult[0] || {};
            prevAllOfftake = parseFloat(prevMetrics.total_sales || 0);
            prevAllSpend = parseFloat(prevPmMetrics.total_spend || 0);
            prevAllAdSales = parseFloat(prevPmMetrics.total_ad_sales || 0);
            const prevAllClicks = parseFloat(prevPmMetrics.total_clicks || 0);
            const prevAllImpressions = parseFloat(prevPmMetrics.total_impressions || 0);
            const prevAllOrders = parseFloat(prevPmMetrics.total_orders || 0);

            // Calculate derived KPIs - Current
            allRoas = allSpend > 0 ? allAdSales / allSpend : 0;
            allConversion = allClicks > 0 ? (allOrders / allClicks) * 100 : 0;
            allCpm = allImpressions > 0 ? (allSpend / allImpressions) * 1000 : 0;
            allCpc = allClicks > 0 ? allSpend / allClicks : 0;

            // Calculate derived KPIs - Previous
            prevAllRoas = prevAllSpend > 0 ? prevAllAdSales / prevAllSpend : 0;
            prevAllConversion = prevAllClicks > 0 ? (prevAllOrders / prevAllClicks) * 100 : 0;
            prevAllCpm = prevAllImpressions > 0 ? (prevAllSpend / prevAllImpressions) * 1000 : 0;
            prevAllCpc = prevAllClicks > 0 ? prevAllSpend / prevAllClicks : 0;

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
            allMarketShare = await getMarketShare(startDate, endDate, null, category, brand, location);
            prevAllMarketShare = await getMarketShare(allMomStart, allMomEnd, null, category, brand, location);



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

        platformOverview.push({
            key: 'all',
            label: 'All',
            type: 'Overall',
            logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
            columns: generateColumns(
                allOfftake, allAvailability, allSos, allMarketShare,
                allSpend, allRoas, allOfftake > 0 ? (allAdSales / allOfftake) * 100 : 0, allConversion, allCpm, allCpc,
                allPromoMyBrand, allPromoCompete,
                // Previous period values for proper MoM comparison
                prevAllOfftake, prevAllAvailability, prevAllSos, prevAllMarketShare,
                prevAllSpend, prevAllRoas, prevAllOfftake > 0 ? (prevAllAdSales / prevAllOfftake) * 100 : 0, prevAllConversion, prevAllCpm, prevAllCpc,
                prevAllPromoMyBrand, prevAllPromoCompete
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

        // ⚠️ OPTIMIZATION: Skip platform-level SOS calculation
        // SOS is a brand metric, not a platform metric. The previous code incorrectly 
        // passed platform names (Zepto, Blinkit) as brand names, causing 2+ minute 
        // queries that returned nothing. Platform SOS will be set to 0.
        // For accurate per-platform SOS, use getShareOfSearch with platform filter.
        const platformSosMap = new Map(); // Empty map - platform SOS not meaningful

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
                const marketShare = await getMarketShare(startDate, endDate, p.label, category, null, locationArr);

                const sos = sosData.current;

                // Availability calculation (in-memory)
                const availability = metrics.curr.deno > 0
                    ? (metrics.curr.neno / metrics.curr.deno) * 100
                    : 0;

                const totalOrders = metrics.curr.orders;

                // Calculate ROAS: Total Ad Sales / Total Spend
                const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;

                // Calculate Conversion: (Total Orders / Total Clicks) * 100
                const conversion = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;

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
                const prevMarketShare = await getMarketShare(momStart, momEnd, p.label, category, null, locationArr);
                const prevImpressions = metrics.prev.impressions;
                const prevSos = sosData.previous;

                const prevAvailability = metrics.prev.deno > 0
                    ? (metrics.prev.neno / metrics.prev.deno) * 100
                    : 0;

                const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;

                // Calculate previous period derived metrics from bulk data
                const prevClicks = metrics.prev.clicks;
                const prevOrders = metrics.prev.orders;
                const prevConversion = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
                const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
                const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

                // Promo metrics not in bulk data - set to 0 for now (can be optimized later)
                const prevPromoMyBrand = 0;
                const prevPromoCompete = 0;

                // Use absolute Ad_Sales for Inorg Sales (matching Performance Matrix formula)
                const currInorgSales = totalAdSales;
                const prevInorgSales = prevAdSales;

                return {
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(
                        // Current period
                        offtake, availability, sos, marketShare, totalSpend, roas, currInorgSales, conversion, cpm, cpc, promoMyBrand, promoCompete,
                        // Previous period
                        prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete
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
            console.log("Calculating Month Overview for Platform:", moPlatform);
        }

        // Generate columns helper for Month Overview (similar to generateColumns but for a single month row)
        // Generate columns helper for Month Overview (similar to generateColumns but for a single month row)
        const generateMonthColumns = (offtake, availability, sos, marketShare, spend = 0, roas = 0, inorgSales = 0, conversion = 0, cpm = 0, cpc = 0) => [
            { title: "Offtakes", value: formatCurrency(offtake), meta: { units: "", change: "▲0.0%" } },
            { title: "Spend", value: formatCurrency(spend), meta: { units: "", change: "▲0.0%" } },
            { title: "ROAS", value: `${roas.toFixed(2)}x`, meta: { units: "", change: "▲0.0%" } },
            { title: "Inorg Sales", value: formatCurrency(inorgSales), meta: { units: "", change: "▲0.0%" } },
            { title: "Conversion", value: `${conversion.toFixed(1)}%`, meta: { units: "", change: "▲0.0%" } },
            { title: "Availability", value: `${availability.toFixed(1)}%`, meta: { units: "", change: "▲0.0%" } },
            { title: "SOS", value: `${sos.toFixed(1)}%`, meta: { units: "", change: "▲0.0%" } },
            { title: "Market Share", value: `${marketShare.toFixed(1)}%`, meta: { units: "", change: "▲0.0%" } },
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
                conds.push(`${src.f.platform} = '${escapeStrMo(moPlatform)}'`);
                if (brandArr && brandArr.length > 0) {
                    const brandConds = brandArr.map(b => `${src.f.brand} LIKE '%${escapeStrMo(b)}%'`).join(' OR ');
                    conds.push(`(${brandConds})`);
                }
                if (locationArr && locationArr.length > 0) {
                    if (locationArr.length === 1) {
                        conds.push(`${src.f.location} = '${escapeStrMo(locationArr[0])}'`);
                    } else {
                        conds.push(`${src.f.location} IN (${locationArr.map(l => `'${escapeStrMo(l)}'`).join(', ')})`);
                    }
                }
                // Apply Product_Category filter for rb_pdp_olap
                const catArrLocal = normalizeFilterArray(filters.category);
                if (catArrLocal && catArrLocal.length > 0) {
                    conds.push(`${src.f.category} IN (${catArrLocal.map(c => `'${escapeStrMo(c)}'`).join(', ')})`);
                }

                // Advanced SKU Search Filters
                const skuArr = normalizeFilterArray(filters.skuName);
                if (skuArr && skuArr.length > 0) {
                    const skuConds = skuArr.map(s => `${src.f.productName} LIKE '%${escapeStrMo(s)}%'`).join(' OR ');
                    conds.push(`(${skuConds})`);
                }
                const skuCodeArr = normalizeFilterArray(filters.skuCode);
                if (skuCodeArr && skuCodeArr.length > 0) {
                    const skuCodeConds = skuCodeArr.map(s => `toString(${src.f.webPid}) LIKE '%${escapeStrMo(s)}%'`).join(' OR ');
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
                // Execute 4 bulk queries in parallel (instead of 28 individual queries)
                const [offtakeByMonth, availByMonth, sosByMonth, msByMonth] = await Promise.all([
                    // Query 1: Offtake metrics grouped by month
                    queryClickHouse(`
                        SELECT 
                            formatDateTime(${dateCol}, '%Y-%m-01') as month,
                            SUM(${src.f.sales}) as total_sales,
                            SUM(${src.f.spend}) as total_spend,
                            SUM(${src.f.adSales}) as total_ad_sales,
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
                            SUM(${src.f.neno}) as total_neno,
                            SUM(${src.f.deno}) as total_deno
                        FROM ${src.table}
                        WHERE ${dateRangeCondition} AND ${mappedPdpConds.join(' AND ')}
                        GROUP BY month
                    `),
                    // Query 3: SOS grouped by month (numerator and denominator)
                    (async () => {
                        const sosBaseConds = [
                            `toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                            `platform_name = '${escapeStrMo(moPlatform)}'`
                        ];
                        const localCatArr = normalizeFilterArray(category);
                        if (localCatArr && localCatArr.length > 0) {
                            if (localCatArr.length === 1) {
                                sosBaseConds.push(`keyword_category = '${escapeStrMo(localCatArr[0])}'`);
                            } else {
                                sosBaseConds.push(`keyword_category IN (${localCatArr.map(c => `'${escapeStrMo(c)}'`).join(', ')})`);
                            }
                        }
                        if (locationArr && locationArr.length > 0) {
                            if (locationArr.length === 1) {
                                sosBaseConds.push(`location_name = '${escapeStrMo(locationArr[0])}'`);
                            } else {
                                sosBaseConds.push(`location_name IN (${locationArr.map(l => `'${escapeStrMo(l)}'`).join(', ')})`);
                            }
                        }

                        const sosNumConds = [...sosBaseConds];
                        if (brandArr && brandArr.length > 0) {
                            if (brandArr.length === 1) {
                                sosNumConds.push(`brand_name_th = '${escapeStrMo(brandArr[0])}'`);
                            } else {
                                sosNumConds.push(`brand_name_th IN (${brandArr.map(b => `'${escapeStrMo(b)}'`).join(', ')})`);
                            }
                        } else {
                            sosNumConds.push(`toString(flag) = '1'`);
                        }

                        const [numByMonth, denomByMonth] = await Promise.all([
                            queryClickHouse(`
                                SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month, countIf(toInt32(overall) = 1) as count
                                FROM rb_kw_olap WHERE ${sosNumConds.join(' AND ')}
                                GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                            `),
                            queryClickHouse(`
                                SELECT formatDateTime(toDate(DATE), '%Y-%m-01') as month, count() as count
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
                        const brandInClause = brandsForNumerator.map(b => `'${escapeStrMo(b)}'`).join(', ');

                        const msBaseConds = [
                            `toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
                            `sales IS NOT NULL`,
                            `platform = '${escapeStrMo(moPlatform)}'`
                        ];
                        if (location && location !== 'All') msBaseConds.push(`location = '${escapeStrMo(location)}'`);
                        const localCatArr = normalizeFilterArray(category);
                        if (localCatArr && localCatArr.length > 0) {
                            if (localCatArr.length === 1) {
                                msBaseConds.push(`category = '${escapeStrMo(localCatArr[0])}'`);
                            } else {
                                msBaseConds.push(`category IN (${localCatArr.map(c => `'${escapeStrMo(c)}'`).join(', ')})`);
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
                    })()
                ]);

                // Build lookup maps
                const offtakeMap = new Map(offtakeByMonth.map(r => [r.month, r]));
                const availMap = new Map(availByMonth.map(r => [r.month, r]));
                const sosNumMap = new Map(sosByMonth.num.map(r => [r.month, parseInt(r.count)]));
                const sosDenomMap = new Map(sosByMonth.denom.map(r => [r.month, parseInt(r.count)]));
                const msMap = new Map(msByMonth.map(r => [r.month, parseFloat(r.avg_ms || 0)]));

                // Generate month overview from bulk data
                monthOverview = monthBuckets.map(bucket => {
                    const monthKey = dayjs(bucket.date).format('YYYY-MM-01');

                    const off = offtakeMap.get(monthKey) || {};
                    const moOfftake = parseFloat(off.total_sales || 0);
                    const moSpend = parseFloat(off.total_spend || 0);
                    const moAdSales = parseFloat(off.total_ad_sales || 0);
                    const moClicks = parseFloat(off.total_clicks || 0);
                    const moImpressions = parseFloat(off.total_impressions || 0);

                    const moRoas = moSpend > 0 ? moAdSales / moSpend : 0;
                    const moConversion = moImpressions > 0 ? (moClicks / moImpressions) * 100 : 0;
                    const moCpm = moImpressions > 0 ? (moSpend / moImpressions) * 1000 : 0;
                    const moCpc = moClicks > 0 ? moSpend / moClicks : 0;

                    const avail = availMap.get(monthKey) || {};
                    const neno = parseFloat(avail.total_neno || 0);
                    const deno = parseFloat(avail.total_deno || 0);
                    const moAvailability = deno > 0 ? (neno / deno) * 100 : 0;

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
                        columns: generateMonthColumns(moOfftake, moAvailability, moSos, moMarketShare, moSpend, moAdSales, moAdSales, moConversion, moCpm, moCpc)
                    };
                });

                console.log(`[Month Overview] OPTIMIZED: Processed ${monthBuckets.length} months with 4 bulk queries (vs ${monthBuckets.length * 4} individual queries)`);

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
            catDataConds.push(`${src.f.platform} = '${escapeStrMain(categoryOverviewPlatform)}'`);
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
                    catConds.push(`${src.f.platform} = '${escapeStrMain(categoryOverviewPlatform)}'`);
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
                    catPromoCompeteResult
                ] = await Promise.all([
                    // Offtake (Sales) & Ad Metrics
                    queryClickHouse(`
                        SELECT 
                            SUM(${src.f.sales}) as total_sales,
                            SUM(${src.f.spend}) as total_spend,
                            SUM(${src.f.adSales}) as total_ad_sales,
                            SUM(${src.f.clicks}) as total_clicks,
                            SUM(${src.f.impressions}) as total_impressions
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
                    getMarketShare(startDate, endDate, null, catName, null, location),
                    // Promo My Brand (Comp_flag = 0)
                    queryClickHouse(`
                        SELECT AVG(CASE WHEN ${src.f.mrp} > 0 THEN (${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} ELSE 0 END) as avg_promo_depth
                        FROM ${src.table} 
                        WHERE ${catCondStr} AND ${src.f.compFlag} = '0'
                    `).then(r => r[0] || {}),
                    // Promo Compete (Comp_flag = 1)
                    queryClickHouse(`
                        SELECT AVG(CASE WHEN ${src.f.mrp} > 0 THEN (${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} ELSE 0 END) as avg_promo_depth
                        FROM ${src.table} 
                        WHERE ${catCondStr} AND ${src.f.compFlag} = '1'
                    `).then(r => r[0] || {})
                ]);

                const catOfftake = parseFloat(catOfftakeResult?.total_sales || 0);
                const catSpend = parseFloat(catOfftakeResult?.total_spend || 0);
                const catAdSales = parseFloat(catOfftakeResult?.total_ad_sales || 0); // Inorg Sales
                const catClicks = parseFloat(catOfftakeResult?.total_clicks || 0);
                const catImpressions = parseFloat(catOfftakeResult?.total_impressions || 0);

                const catMarketShare = parseFloat(catMsResult || 0);

                const catPromoMyBrand = parseFloat(catPromoMyBrandResult?.avg_promo_depth || 0) * 100;
                const catPromoCompete = parseFloat(catPromoCompeteResult?.avg_promo_depth || 0) * 100;

                // Debug logging for troubleshooting
                console.log(`[Category Overview] ${catName}: Offtake=${catOfftake}, Spend=${catSpend}, AdSales=${catAdSales}, Clicks=${catClicks}, Impressions=${catImpressions}`);
                console.log(`[Category Overview] ${catName}: MarketShare=${catMarketShare.toFixed(1)}%`);
                console.log(`[Category Overview] ${catName}: PromoMyBrand=${catPromoMyBrand.toFixed(1)}%, PromoCompete=${catPromoCompete.toFixed(1)}%`);

                // Calculate Metrics
                const catRoas = catSpend > 0 ? catAdSales / catSpend : 0;
                const catConversion = catImpressions > 0 ? (catClicks / catImpressions) * 100 : 0;
                const catCpm = catImpressions > 0 ? (catSpend / catImpressions) * 1000 : 0;
                const catCpc = catClicks > 0 ? catSpend / catClicks : 0;



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
                            value: `${catRoas.toFixed(1)}x`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "return", change: "▲0.0%" }
                        },
                        {
                            title: "Inorg Sales",
                            value: catOfftake > 0 ? `${((catAdSales / catOfftake) * 100).toFixed(1)}%` : "0%",
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: formatCurrency(catAdSales), change: "▲0.0%" }
                        },
                        {
                            title: "Conversion",
                            value: `${catConversion.toFixed(1)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "Orders / Clicks", change: "▲0.0%" }
                        },
                        {
                            title: "Availability",
                            value: `${catAvailability.toFixed(1)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "stores", change: "▲0.0%" }
                        },
                        {
                            title: "SOS",
                            value: `${catSos.toFixed(1)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "index", change: "▲0.0%" }
                        },
                        {
                            title: "Market Share",
                            value: `${catMarketShare.toFixed(1)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "share", change: "▲0.0%" }
                        },
                        {
                            title: "Promo My Brand",
                            value: `${catPromoMyBrand.toFixed(1)}%`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "depth", change: "▲0.0%" }
                        },
                        {
                            title: "Promo Compete",
                            value: `${catPromoCompete.toFixed(1)}%`,
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
        const distinctBrands = await queryClickHouse(`
            SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table}
            WHERE ${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
            ${brandsOverviewPlatform && brandsOverviewPlatform !== 'All' ? `AND ${src.f.platform} = '${escapeStrMain(brandsOverviewPlatform)}'` : ''}
            ${brandsOverviewCategoryArr.length > 0 ? `AND ${src.f.category} IN (${brandsOverviewCategoryArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})` : ''}
            ORDER BY brand
        `);

        // 1. Offtake Current - Using ClickHouse instead of Sequelize
        const boOfftakeConds = [
            `${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
            `${src.f.compFlag} = '0'`
        ];
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            boOfftakeConds.push(`${src.f.platform} = '${escapeStrMain(brandsOverviewPlatform)}'`);
        }
        if (brand && brand !== 'All') {
            boOfftakeConds.push(`${src.f.brand} LIKE '%${escapeStrMain(brand)}%'`);
        }
        const boLocArr = normalizeFilterArray(location);
        if (boLocArr && boLocArr.length > 0) {
        }
        if (brandsOverviewCategoryArr && brandsOverviewCategoryArr.length > 0) {
            if (brandsOverviewCategoryArr.length === 1) {
                boOfftakeConds.push(`${PRODUCT_CATEGORY_SQL} = '${escapeStrMain(brandsOverviewCategoryArr[0])}'`);
            } else {
                boOfftakeConds.push(`${PRODUCT_CATEGORY_SQL} IN (${brandsOverviewCategoryArr.map(c => `'${escapeStrMain(c)}'`).join(', ')})`);
            }
        }

        const boOfftakePromise = queryClickHouse(`
            SELECT 
                ${src.f.brand} as Brand,
                SUM(${src.f.sales}) as total_sales,
                SUM(${src.f.spend}) as total_spend,
                SUM(${src.f.adSales}) as total_ad_sales,
                SUM(${src.f.orders}) as total_ad_orders,
                SUM(${src.f.clicks}) as total_ad_clicks,
                SUM(${src.f.impressions}) as total_ad_impressions,
                AVG(${src.f.discount}) as avg_discount,
                SUM(${src.f.neno}) as total_neno,
                SUM(${src.f.deno}) as total_deno
            FROM ${src.table}
            WHERE ${boOfftakeConds.join(' AND ')}
            GROUP BY Brand
        `);

        // Previous period offtake conditions
        const boPrevOfftakeConds = [
            `${dateCol} BETWEEN '${boPrevStartDate.format('YYYY-MM-DD')}' AND '${boPrevEndDate.format('YYYY-MM-DD')}'`,
            `${src.f.compFlag} = '0'`
        ];
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            boPrevOfftakeConds.push(`${src.f.platform} = '${escapeStrMain(brandsOverviewPlatform)}'`);
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
            boPrevOfftakeConds.push(`Location IN (${locArr2.map(l => `'${escapeStrMain(l)}'`).join(', ')})`);
        }

        // Brand list conditions for ClickHouse
        const rcaBrandConds = [`toString(comp_flag) = '0'`, `brand_name IS NOT NULL`, `brand_name != ''`];
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            rcaBrandConds.push(`platform = '${escapeStrMain(brandsOverviewPlatform)}'`);
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
            boPrevOfftakeData,
            boMsData,
            boPrevMsData,
            rcaBrandsData
        ] = await Promise.all([
            // 1. Offtake Current
            boOfftakePromise,
            // 2. Offtake Previous - ClickHouse
            queryClickHouse(`
                SELECT 
                    ${src.f.brand} as Brand,
                    SUM(${src.f.sales}) as total_sales,
                    SUM(${src.f.spend}) as total_spend,
                    SUM(${src.f.adSales}) as total_ad_sales,
                    SUM(${src.f.orders}) as total_ad_orders,
                    SUM(${src.f.clicks}) as total_ad_clicks,
                    SUM(${src.f.impressions}) as total_ad_impressions,
                    AVG(${src.f.discount}) as avg_discount,
                    SUM(${src.f.neno}) as total_neno,
                    SUM(${src.f.deno}) as total_deno
                FROM ${src.table} 
                WHERE ${boPrevOfftakeConds.join(' AND ')}
                GROUP BY Brand
            `),
            // 3. Market Share Current
            (async () => {
                try {
                    const msMap = await getMarketShareByBrand(startDate, endDate, platformArr, category, brand, location);
                    return Array.from(msMap.entries()).map(([b, ms]) => ({ brand: b, avg_ms: ms }));
                } catch (err) {
                    console.error('[BrandsOverview] MS Current error:', err.message);
                    return [];
                }
            })(),
            // 4. Market Share Previous
            (async () => {
                try {
                    const msMap = await getMarketShareByBrand(boPrevStartDate, boPrevEndDate, platformArr, category, brand, location);
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
        const boPrevOfftakeMap = toMap(boPrevOfftakeData);
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

        // Generate coalesce key for SOS calculation
        const sosCoalesceKey = `bulk-sos:${platform || 'All'}:${startDate.format('YYYY-MM-DD')}:${endDate.format('YYYY-MM-DD')}:${location || 'All'}:${category || 'All'}`;

        let bulkSosMap;
        try {
            bulkSosMap = await coalesceRequest(sosCoalesceKey, async () =>
                await getBulkShareOfSearch(
                    boBrands,
                    startDate, endDate,           // Current period
                    boPrevStartDate, boPrevEndDate, // Previous period
                    platform, location, category
                )
            );
        } catch (err) {
            console.error('[Brands Overview] Bulk SOS Error:', err.message);
            bulkSosMap = new Map();
        }

        console.timeEnd(brandsSosTimerLabel);
        console.log(`[Brands Overview] SOS calculated for ${bulkSosMap.size} brands`);

        const brandsOverview = await Promise.all(boBrands.map(async brandName => {
            // Offtake
            const currSales = findMetric(boOfftakeMap, brandName, 'total_sales');
            const prevSales = findMetric(boPrevOfftakeMap, brandName, 'total_sales');
            const salesTrend = calcTrend(currSales, prevSales);

            // Spend
            const currSpend = findMetric(boOfftakeMap, brandName, 'total_spend');
            const prevSpend = findMetric(boPrevOfftakeMap, brandName, 'total_spend');
            const spendTrend = calcTrend(currSpend, prevSpend);

            // ROAS
            const currAdSales = findMetric(boOfftakeMap, brandName, 'total_ad_sales');
            const prevAdSales = findMetric(boPrevOfftakeMap, brandName, 'total_ad_sales');
            const currRoas = currSpend > 0 ? currAdSales / currSpend : 0;
            const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
            const roasTrend = calcTrend(currRoas, prevRoas);

            // console.log(`[Brands ROAS Debug] Brand: ${brandName}, currAdSales: ${currAdSales}, currSpend: ${currSpend}, currRoas: ${currRoas}`);

            // Inorg Sales
            const currInorgPct = currSales > 0 ? (currAdSales / currSales) * 100 : 0;
            const prevInorgPct = prevSales > 0 ? (prevAdSales / prevSales) * 100 : 0;
            const inorgPctTrend = calcTrendPp(currInorgPct, prevInorgPct);

            // Conversion
            const currOrders = findMetric(boOfftakeMap, brandName, 'total_ad_orders');
            const prevOrders = findMetric(boPrevOfftakeMap, brandName, 'total_ad_orders');
            const currClicks = findMetric(boOfftakeMap, brandName, 'total_ad_clicks');
            const prevClicks = findMetric(boPrevOfftakeMap, brandName, 'total_ad_clicks');
            const currConv = currClicks > 0 ? (currOrders / currClicks) * 100 : 0;
            const prevConv = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
            const convTrend = calcTrendPp(currConv, prevConv);

            // Availability
            const currNeno = findMetric(boOfftakeMap, brandName, 'total_neno');
            const prevNeno = findMetric(boPrevOfftakeMap, brandName, 'total_neno');
            const currDeno = findMetric(boOfftakeMap, brandName, 'total_deno');
            const prevDeno = findMetric(boPrevOfftakeMap, brandName, 'total_deno');
            const currAvail = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;
            const prevAvail = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;
            const availTrend = calcTrendPp(currAvail, prevAvail);


            // SOS - Lookup from pre-calculated bulk map (NO DATABASE QUERY!)
            const sosData = bulkSosMap.get(brandName) || { current: 0, previous: 0 };
            const currSos = sosData.current;
            const prevSos = sosData.previous;
            const sosTrend = calcTrendPp(currSos, prevSos);


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
            const currImp = findMetric(boOfftakeMap, brandName, 'total_ad_impressions');
            const prevImp = findMetric(boPrevOfftakeMap, brandName, 'total_ad_impressions');
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
                    { title: "Offtakes", value: formatCurrency(currSales), meta: { units: `${(currSales / 100000).toFixed(2)} L`, change: `${salesTrend >= 0 ? '▲' : '▼'}${Math.abs(salesTrend).toFixed(1)}%` } },
                    { title: "Spend", value: formatCurrency(currSpend), meta: { units: formatCurrency(currSpend), change: `${spendTrend >= 0 ? '▲' : '▼'}${Math.abs(spendTrend).toFixed(1)}%` } },
                    { title: "ROAS", value: `${currRoas.toFixed(1)}x`, meta: { units: `${formatCurrency(currAdSales)}`, change: `${roasTrend >= 0 ? '▲' : '▼'}${Math.abs(roasTrend).toFixed(1)}%` } },
                    {
                        title: "Inorg Sales",
                        value: `${currInorgPct.toFixed(1)}%`,
                        meta: { units: formatCurrency(currAdSales), change: `${inorgPctTrend >= 0 ? '▲' : '▼'}${Math.abs(inorgPctTrend).toFixed(1)}%` }
                    },
                    { title: "Conversion", value: `${currConv.toFixed(1)}%`, meta: { units: `${(currOrders / 1000).toFixed(1)}k`, change: `${convTrend >= 0 ? '▲' : '▼'}${Math.abs(convTrend).toFixed(1)}%` } },
                    { title: "Availability", value: `${currAvail.toFixed(1)}%`, meta: { units: `${currDeno}`, change: `${availTrend >= 0 ? '▲' : '▼'}${Math.abs(availTrend).toFixed(1)}%` } },
                    { title: "SOS", value: `${currSos.toFixed(1)}%`, meta: { units: `${currSos.toFixed(1)}`, change: `${sosTrend >= 0 ? '▲' : '▼'}${Math.abs(sosTrend).toFixed(1)}%` } },
                    { title: "Market Share", value: `${currMs.toFixed(1)}%`, meta: { units: formatCurrency(currSales * (100 / currMs) || 0), change: `${msTrend >= 0 ? '▲' : '▼'}${Math.abs(msTrend).toFixed(1)}%` } },
                    { title: "Promo My Brand", value: `${currDisc.toFixed(1)}%`, meta: { units: `${currDisc.toFixed(1)}%`, change: `${discTrend >= 0 ? '▲' : '▼'}${Math.abs(discTrend).toFixed(1)}%` } },
                    { title: "Promo Compete", value: `${otherBrandsAvgDisc.toFixed(1)}%`, meta: { units: `${otherBrandsAvgDisc.toFixed(1)}%`, change: `${promoCompeteTrend >= 0 ? '▲' : '▼'}${Math.abs(promoCompeteTrend).toFixed(1)}%` } },
                    { title: "CPM", value: formatCurrency(currCpm), meta: { units: formatCurrency(currCpm), change: `${cpmTrend >= 0 ? '▲' : '▼'}${Math.abs(cpmTrend).toFixed(1)}%` } },
                    { title: "CPC", value: formatCurrency(currCpc), meta: { units: formatCurrency(currCpc), change: `${cpcTrend >= 0 ? '▲' : '▼'}${Math.abs(cpcTrend).toFixed(1)}%` } }
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
        const src = await getWatchtowerSource();
        let query;
        if (channel && channel !== 'All') {
            // When channel is specified, get platforms from rca_sku_dim for that channel
            const escapedChannel = channel.replace(/'/g, "''");
            query = `SELECT DISTINCT platform FROM rca_sku_dim WHERE platform IS NOT NULL AND platform != '' AND channel = '${escapedChannel}' ORDER BY platform`;
        } else {
            // No channel filter — get all platforms from dynamic source
            query = `SELECT DISTINCT ${src.f.platform} as platform FROM ${src.table} WHERE ${src.f.platform} IS NOT NULL AND ${src.f.platform} != '' ORDER BY platform`;
        }
        const results = await queryClickHouse(query);
        return results.map(p => p.platform).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching platforms:", error);
        return [];
    }
};

const getChannels = async () => {
    try {
        const query = `SELECT DISTINCT channel FROM rca_sku_dim WHERE channel IS NOT NULL AND channel != '' ORDER BY channel`;
        const results = await queryClickHouse(query);
        return results.map(r => r.channel).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching channels from rca_sku_dim:", error);
        return [];
    }
};

// Exported function - no caching layer
const getSummaryMetrics = async (filters) => {
    return await computeSummaryMetrics(filters);
};

const getBrands = async (platform, includeCompetitors = false) => {
    try {
        const src = await getWatchtowerSource();
        // Query appropriate source for brands
        const conditions = [`${src.f.brand} IS NOT NULL`, `${src.f.brand} != ''`];
        if (platform && platform !== 'All') {
            // Support multi-value: comma-separated string or array
            const platArr = Array.isArray(platform) ? platform : platform.split(',').map(p => p.trim()).filter(Boolean);
            if (platArr.length === 1) {
                conditions.push(`${src.f.platform} = '${platArr[0].replace(/'/g, "''")}'`);
            } else if (platArr.length > 1) {
                conditions.push(`${src.f.platform} IN (${platArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`);
            }
        }
        if (!includeCompetitors) {
            conditions.push(`toString(${src.f.compFlag}) = '0'`);
        }

        const query = `SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY brand`;
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
        if (brand) {
            conditions.push(`brand_name_th = '${brand.replace(/'/g, "''")}'`);
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
        const src = await getWatchtowerSource();
        // Query appropriate source for locations
        const conditions = [`${src.f.location} IS NOT NULL`, `${src.f.location} != ''`];
        if (platform && platform !== 'All') {
            // Support multi-value: comma-separated string or array
            const platArr = Array.isArray(platform) ? platform : platform.split(',').map(p => p.trim()).filter(Boolean);
            if (platArr.length === 1) {
                conditions.push(`${src.f.platform} = '${platArr[0].replace(/'/g, "''")}'`);
            } else if (platArr.length > 1) {
                conditions.push(`${src.f.platform} IN (${platArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`);
            }
        }
        if (brand && brand !== 'All') {
            // Support multi-value brand
            const brandArr = Array.isArray(brand) ? brand : brand.split(',').map(b => b.trim()).filter(Boolean);
            if (brandArr.length === 1) {
                conditions.push(`${src.f.brand} LIKE '%${brandArr[0].replace(/'/g, "''")}'`);
            } else if (brandArr.length > 1) {
                conditions.push(`(${brandArr.map(b => `${src.f.brand} LIKE '%${b.replace(/'/g, "''")}'`).join(' OR ')})`);
            }
        }
        if (!includeCompetitors) {
            conditions.push(`toString(${src.f.compFlag}) = '0'`);
        }

        const query = `SELECT DISTINCT ${src.f.location} as location FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY location`;
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
        const { brand, location, platform, period, timeStep, category, startDate: customStart, endDate: customEnd, channel, skuName, skuCode } = filters;

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

        const src = await getWatchtowerSource();
        // 3. Build WHERE conditions for dynamic source
        const buildPdpConds = () => {
            const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
            const conds = [`${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

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
                if (trendLocArr.length === 1) {
                    conds.push(`${src.f.location} = '${escapeStr(trendLocArr[0])}'`);
                } else {
                    conds.push(`${src.f.location} IN (${trendLocArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                }
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

            return conds.join(' AND ');
        };

        const pdpConds = buildPdpConds();

        // Query for Offtake, OSA, Discount from dynamic source
        const trendResults = await queryClickHouse(`
            SELECT 
                ${groupExpression.replace('DATE', src.f.date)} as date_group,
                MAX(toDate(${src.f.date})) as ref_date,
                SUM(${src.f.sales}) as offtake,
                SUM(${src.f.neno}) as total_neno,
                SUM(${src.f.deno}) as total_deno,
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

        // Numerator: Our brands using flag=0 and countIf(overall=1)
        const sosNumConds = buildSosConds();
        const sosNumerator = await queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, countIf(toInt32(overall) = 1) as count
            FROM rb_kw_olap
            WHERE ${sosNumConds} AND toString(flag) = '1'
            GROUP BY ${groupExpressionKw}
        `);

        // Denominator: All products (no brand filter)
        const sosDenominator = await queryClickHouse(`
            SELECT ${groupExpressionKw} as date_group, count() as count
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
            const neno = parseFloat(row.total_neno || 0);
            const deno = parseFloat(row.total_deno || 0);
            const osa = deno > 0 ? (neno / deno) * 100 : 0;

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
                osa: parseFloat(osa.toFixed(1)),
                categoryShare: parseFloat(categoryShare.toFixed(1)),
                MarketShare: parseFloat(categoryShare.toFixed(1)), // Overall MS in this context is same as categoryShare if cat filter applied
                marketShare: parseFloat(categoryShare.toFixed(1)),
                discount: parseFloat(discount.toFixed(1)),
                sov: parseFloat(sov.toFixed(1))
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
        const allowedCategories = ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
        const dbName = getCurrentDbName();
        if (dbName === 'mars') {
            const src = await getWatchtowerSource();
            const catCol = src.f.category;
            const conditions = [`${catCol} IN (${allowedCategories.map(c => `'${c.replace(/'/g, "''")}'`).join(',')})`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conditions.push(`${src.f.platform} IN (${platArr.map(p => `'${p.replace(/'/g, "''")}'`).join(',')})`);
            }
            const query = `SELECT DISTINCT ${catCol} as category FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY category ASC`;
            const rows = await queryClickHouse(query);
            return rows.map(r => r.category);
        }
        return allowedCategories;
    } catch (error) {
        console.error("Error fetching brand categories:", error);
        return ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
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

    const { months = 1, startDate: qStartDate, endDate: qEndDate, compareStartDate: qCompareStartDate, compareEndDate: qCompareEndDate, channel, skuName, skuCode } = filters;

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
        if (val >= 100000) return `₹${(val / 100000).toFixed(2)} lac`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
        return `₹${val.toFixed(2)}`;
    };

    // Fetch platforms from rca_sku_dim
    const cachedPlatforms = await getCachedDistinctPlatforms();
    let platformDefinitions = cachedPlatforms;

    if (!platformDefinitions) {
        const platformsFromDb = await queryClickHouse(`SELECT DISTINCT platform FROM rca_sku_dim WHERE platform IS NOT NULL AND platform != ''`);

        const getPlatformLogo = (name) => {
            const logoMap = {
                'zepto': 'https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png',
                'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg',
                'swiggy': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
                'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
                'flipkart': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Flipkart-logo.png',
                'instamart': '/instamart.jpeg',
                'swiggy instamart': '/instamart.jpeg'
            };
            return logoMap[name.toLowerCase()] || 'https://cdn-icons-png.flaticon.com/512/3502/3502685.png';
        };

        const getPlatformType = (name) => {
            const qCommerce = ['zepto', 'blinkit', 'swiggy instamart', 'dunzo'];
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
    if (channel === 'Ecommerce' || channel === 'E-commerce' || channel === 'Ecom') {
        const ecomPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy', 'amazon', 'flipkart', 'bigbasket', 'jiomart'];
        platformDefinitions = platformDefinitions.filter(p => ecomPlatforms.some(ep => p.label.toLowerCase().includes(ep)));
    } else if (channel === 'Modern Trades' || channel === 'ModernTrade') {
        const ecomPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy', 'amazon', 'flipkart', 'bigbasket', 'jiomart'];
        platformDefinitions = platformDefinitions.filter(p => !ecomPlatforms.some(ep => p.label.toLowerCase().includes(ep)));
    }

    // Calculate MoM dates or use provided comparison dates
    let momStart = startDate.clone().subtract(1, 'month');
    let momEnd = endDate.clone().subtract(1, 'month');

    if (qCompareStartDate && qCompareEndDate) {
        momStart = dayjs(qCompareStartDate).startOf('day');
        momEnd = dayjs(qCompareEndDate).endOf('day');
    }

    // Get the optimized data source (Materialized View table or raw table)
    const src = await getWatchtowerSource();

    // ===== INLINE BULK PLATFORM METRICS QUERY - USING CLICKHOUSE =====
    // Helper to escape strings for ClickHouse
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Build base conditions for rb_pdp_olap
    const buildOfftakeConds = (start, end) => {
        // If using aggregated table, column names are lowercase and simple
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];

        const brandCol = src.isAgg ? 'brand' : 'Brand';
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `${brandCol} LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
        }

        const locCol = src.isAgg ? 'location' : 'Location';
        if (locationArr && locationArr.length > 0) {
            conds.push(`${locCol} IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
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
                const skuCodeConds = skuCodeArrArr.map(s => `toString(Web_Pid) LIKE '%${escapeStr(s)}%'`).join(' OR ');
                conds.push(`(${skuCodeConds})`);
            }
        }

        return conds.join(' AND ');
    };

    // Build base conditions for rb_kw_olap (SOS / Ad SOV / Organic SOV)
    const buildSosConds = (start, end) => {
        const conds = [`toDate(DATE) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`];
        if (locationArr && locationArr.length > 0) {
            conds.push(`lower(location_name) IN (${locationArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`lower(keyword_category) IN (${categoryArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }
        // Apply brand filter (rb_kw_olap uses brand_name_th column)
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `lower(brand_name_th) LIKE lower('%${escapeStr(b)}%')`).join(' OR ')})`);
        }

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
            conds.push(`location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
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
    const currSosConds = buildSosConds(startDate, endDate);
    const prevSosConds = buildSosConds(momStart, momEnd);

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

    const [currData, prevData, currSosOurBrands, currSosTotal, prevSosOurBrands, prevSosTotal, currMsNum, currMsDenom, prevMsNum, prevMsDenom, currCatSizeByPlatform, prevCatSizeByPlatform, currAdSovOur, currAdSovTotal, prevAdSovOur, prevAdSovTotal, currOrgSovOur, currOrgSovTotal, prevOrgSovOur, prevOrgSovTotal] = await Promise.all([
        // Query 1: Current period offtake metrics by platform
        queryClickHouse(`
                    SELECT ${src.f.platform} as Platform,
                        SUM(${src.f.sales}) as sales,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as qty,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as spend,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as ad_sales,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as clicks,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as impressions,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as orders,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as neno,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as deno,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as my_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as comp_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales
                    FROM ${src.table}
                    WHERE ${currOfftakeConds}
                    GROUP BY Platform
                `),
        // Query 2: Previous period offtake metrics by platform
        queryClickHouse(`
                    SELECT ${src.f.platform} as Platform,
                        SUM(${src.f.sales}) as sales,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as qty,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as spend,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as ad_sales,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as clicks,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as impressions,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as orders,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as neno,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as deno,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as my_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as comp_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales
                    FROM ${src.table}
                    WHERE ${prevOfftakeConds}
                    GROUP BY Platform
                `),
        // Query 3: Current SOS - countIf(overall=1) and count() per platform (flag=0 for our brands)
        queryClickHouse(`
                    SELECT platform_name, countIf(toInt32(overall) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 4: Current SOS - Total count per platform
        queryClickHouse(`
                    SELECT platform_name, count() as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 5: Previous SOS - countIf(overall=1) per platform (flag=0 for our brands)
        queryClickHouse(`
                    SELECT platform_name, countIf(toInt32(overall) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 6: Previous SOS - Total count per platform
        queryClickHouse(`
                    SELECT platform_name, count() as count
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
        // Query 13: Current Spons SOS (Ad SOV) - countIf(spons=1) per platform (flag=0 for our brands)
        queryClickHouse(`
                    SELECT platform_name, countIf(toInt32(spons) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 14: Current Spons SOS (Ad SOV) - Total count per platform
        queryClickHouse(`
                    SELECT platform_name, count() as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 15: Previous Spons SOS (Ad SOV) - countIf(spons=1) per platform (flag=0 for our brands)
        queryClickHouse(`
                    SELECT platform_name, countIf(toInt32(spons) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 16: Previous Spons SOS (Ad SOV) - Total count per platform
        queryClickHouse(`
                    SELECT platform_name, count() as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 17: Current Organic SOS - countIf(organic=1) per platform (flag=0 for our brands)
        queryClickHouse(`
                    SELECT platform_name, countIf(toInt32(organic) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 18: Current Organic SOS - Total count per platform
        queryClickHouse(`
                    SELECT platform_name, count() as count
                    FROM rb_kw_olap
                    WHERE ${currSosConds}
                    GROUP BY platform_name
                `),
        // Query 19: Previous Organic SOS - countIf(organic=1) per platform (flag=0 for our brands)
        queryClickHouse(`
                    SELECT platform_name, countIf(toInt32(organic) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${prevSosConds}
                    GROUP BY platform_name
                `),
        // Query 20: Previous Organic SOS - Total count per platform
        queryClickHouse(`
                    SELECT platform_name, count() as count
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
        return { platform: r.platform, avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : 0 };
    });

    const prevMsNumMap = new Map(prevMsNum.map(r => [r.platform?.toLowerCase(), parseFloat(r.our_sales || 0)]));
    const prevMsDenomMap = new Map(prevMsDenom.map(r => [r.platform?.toLowerCase(), parseFloat(r.total_sales || 0)]));

    // Calculate sumCatSize from all query results (not just those in platformDefinitions)
    const sumCatSize = currCatSizeByPlatform.reduce((sum, r) => sum + parseFloat(r.cat_size || 0), 0);
    const prevSumCatSize = prevCatSizeByPlatform.reduce((sum, r) => sum + parseFloat(r.cat_size || 0), 0);

    // Map platform category sizes for fuzzy matching later
    const currCatSizeByPlatformMap = new Map(currCatSizeByPlatform.map(r => [r.platform?.toLowerCase(), parseFloat(r.cat_size || 0)]));
    const prevCatSizeByPlatformMap = new Map(prevCatSizeByPlatform.map(r => [r.platform?.toLowerCase(), parseFloat(r.cat_size || 0)]));

    const prevMs = prevMsDenom.map(r => {
        const key = r.platform?.toLowerCase();
        const ourSales = prevMsNumMap.get(key) || 0;
        const totalSales = parseFloat(r.total_sales || 0);
        return { platform: r.platform, avg_ms: totalSales > 0 ? (ourSales / totalSales) * 100 : 0 };
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
    const currMsMap = new Map(currMs.map(r => [r.platform?.toLowerCase(), parseFloat(r.avg_ms) || 0]));
    const prevMsMap = new Map(prevMs.map(r => [r.platform?.toLowerCase(), parseFloat(r.avg_ms) || 0]));

    // Helper to calculate SOS percentage
    const calcSos = (ourCount, totalCount) => totalCount > 0 ? (ourCount / totalCount) * 100 : 0;

    // Build bulk platform metrics map
    const bulkPlatformMap = new Map();
    platformDefinitions.forEach(p => {
        const key = p.label.toLowerCase();
        const c = currData.find(d => d.Platform && d.Platform.toLowerCase() === key);
        const pv = prevData.find(d => d.Platform && d.Platform.toLowerCase() === key);

        // Calculate SOS for this platform
        const currSosValue = calcSos(currSosOurMap.get(key) || 0, currSosTotalMap.get(key) || 0);
        const prevSosValue = calcSos(prevSosOurMap.get(key) || 0, prevSosTotalMap.get(key) || 0);

        // Calculate Ad SOV for this platform (spons_flag=1)
        const currAdSovValue = calcSos(currAdSovOurMap.get(key) || 0, currAdSovTotalMap.get(key) || 0);
        const prevAdSovValue = calcSos(prevAdSovOurMap.get(key) || 0, prevAdSovTotalMap.get(key) || 0);

        // Calculate Organic SOV for this platform (spons_flag=0)
        const currOrgSovValue = calcSos(currOrgSovOurMap.get(key) || 0, currOrgSovTotalMap.get(key) || 0);
        const prevOrgSovValue = calcSos(prevOrgSovOurMap.get(key) || 0, prevOrgSovTotalMap.get(key) || 0);

        // Get Market Share for this platform
        const currMsValue = currMsMap.get(key) || 0;
        const prevMsValue = prevMsMap.get(key) || 0;

        bulkPlatformMap.set(p.label, {
            curr: {
                sales: parseFloat(c?.sales || 0),
                qty: parseFloat(c?.qty || 0),
                spend: parseFloat(c?.spend || 0),
                adSales: parseFloat(c?.ad_sales || 0),
                clicks: parseFloat(c?.clicks || 0),
                impressions: parseFloat(c?.impressions || 0),
                orders: parseFloat(c?.orders || 0),
                neno: parseFloat(c?.neno || 0),
                deno: parseFloat(c?.deno || 0),
                ms: currMsValue,
                sos: currSosValue,
                adSov: currAdSovValue,
                organicSov: currOrgSovValue,
                denomMS: currMsDenomMap.get(key) || 0,
                myMrpVal: parseFloat(c?.my_mrp_val || 0),
                myActualSales: parseFloat(c?.my_actual_sales || 0),
                compMrpVal: parseFloat(c?.comp_mrp_val || 0),
                compActualSales: parseFloat(c?.comp_actual_sales || 0)
            },
            prev: {
                sales: parseFloat(pv?.sales || 0),
                qty: parseFloat(pv?.qty || 0),
                spend: parseFloat(pv?.spend || 0),
                adSales: parseFloat(pv?.ad_sales || 0),
                clicks: parseFloat(pv?.clicks || 0),
                impressions: parseFloat(pv?.impressions || 0),
                orders: parseFloat(pv?.orders || 0),
                neno: parseFloat(pv?.neno || 0),
                deno: parseFloat(pv?.deno || 0),
                ms: prevMsValue,
                sos: prevSosValue,
                adSov: prevAdSovValue,
                organicSov: prevOrgSovValue,
                denomMS: prevMsDenomMap.get(key) || 0,
                myMrpVal: parseFloat(pv?.my_mrp_val || 0),
                myActualSales: parseFloat(pv?.my_actual_sales || 0),
                compMrpVal: parseFloat(pv?.comp_mrp_val || 0),
                compActualSales: parseFloat(pv?.comp_actual_sales || 0)
            }
        });
    });
    console.log(`[getPlatformOverview] Bulk query complete for ${platformDefinitions.length} platforms`);

    // Helper functions (moved to module level)

    const platformOverview = [];

    // "All" row - aggregate across all platforms using ClickHouse
    const allConds = buildOfftakeConds(startDate, endDate);
    const prevAllConds = buildOfftakeConds(momStart, momEnd);

    const [allMetricsResult, prevAllMetricsResult] = await Promise.all([
        queryClickHouse(`
                    SELECT 
                        SUM(${src.f.sales}) as total_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.quantitySold} ELSE 0 END) as total_qty,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.orders} ELSE 0 END) as total_inorg_qty,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 AND ${src.f.mrp} > 0 THEN ${src.f.mrp} * ${src.f.quantitySold} ELSE 0 END) as my_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 AND ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} * ${src.f.quantitySold} ELSE 0 END) as my_actual_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 1 AND ${src.f.mrp} > 0 THEN ${src.f.mrp} * ${src.f.quantitySold} ELSE 0 END) as comp_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlag} = 1 AND ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} * ${src.f.quantitySold} ELSE 0 END) as comp_actual_sales
                    FROM ${src.table}
                    WHERE ${allConds}
                `),
        queryClickHouse(`
                    SELECT 
                        SUM(${src.f.sales}) as total_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.quantitySold} ELSE 0 END) as total_qty,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.orders} ELSE 0 END) as total_inorg_qty,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 AND ${src.f.mrp} > 0 THEN ${src.f.mrp} * ${src.f.quantitySold} ELSE 0 END) as my_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 AND ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} * ${src.f.quantitySold} ELSE 0 END) as my_actual_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 1 AND ${src.f.mrp} > 0 THEN ${src.f.mrp} * ${src.f.quantitySold} ELSE 0 END) as comp_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlag} = 1 AND ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} * ${src.f.quantitySold} ELSE 0 END) as comp_actual_sales
                    FROM ${src.table}
                    WHERE ${prevAllConds}
                `)
    ]);

    const allMetrics = allMetricsResult[0] || {};
    const allOfftake = parseFloat(allMetrics.total_sales || 0);
    const allOfftakeUnits = parseFloat(allMetrics.total_qty || 0);
    const allSpend = parseFloat(allMetrics.total_spend || 0);
    const allAdSales = parseFloat(allMetrics.total_ad_sales || 0);
    const allInorgUnits = parseFloat(allMetrics.total_inorg_qty || 0);
    const allClicks = parseFloat(allMetrics.total_clicks || 0);
    const allImpressions = parseFloat(allMetrics.total_impressions || 0);
    const allOrders = parseFloat(allMetrics.total_inorg_qty || 0); // Quantity sold via ads
    const allNeno = parseFloat(allMetrics.total_neno || 0);
    const allDeno = parseFloat(allMetrics.total_deno || 0);

    const allAvailability = allDeno > 0 ? (allNeno / allDeno) * 100 : 0;
    const allRoas = allSpend > 0 ? allAdSales / allSpend : 0;
    // Conversion = (Orders / Clicks) * 100 (Standard percentage)
    const allConversion = allClicks > 0 ? (allOrders / allClicks) * 100 : 0;
    const allCpm = allImpressions > 0 ? (allSpend / allImpressions) * 1000 : 0;
    const allCpc = allClicks > 0 ? allSpend / allClicks : 0;
    const allInorgSales = allAdSales; // Absolute value in currency

    const allPromoMyBrand = parseFloat(allMetrics.my_mrp_val || 0) > 0
        ? ((parseFloat(allMetrics.my_mrp_val) - parseFloat(allMetrics.my_actual_sales)) / parseFloat(allMetrics.my_mrp_val)) * 100
        : 0;
    const allPromoCompete = parseFloat(allMetrics.comp_mrp_val || 0) > 0
        ? ((parseFloat(allMetrics.comp_mrp_val) - parseFloat(allMetrics.comp_actual_sales)) / parseFloat(allMetrics.comp_mrp_val)) * 100
        : 0;

    // Previous period for "All" row
    const prevAllMetrics = prevAllMetricsResult[0] || {};
    const prevAllOfftake = parseFloat(prevAllMetrics.total_sales || 0);
    const prevAllOfftakeUnits = parseFloat(prevAllMetrics.total_qty || 0);
    const prevAllSpend = parseFloat(prevAllMetrics.total_spend || 0);
    const prevAllAdSales = parseFloat(prevAllMetrics.total_ad_sales || 0);
    const prevAllInorgUnits = parseFloat(prevAllMetrics.total_inorg_qty || 0);
    const prevAllClicks = parseFloat(prevAllMetrics.total_clicks || 0);
    const prevAllImpressions = parseFloat(prevAllMetrics.total_impressions || 0);
    const prevAllOrders = parseFloat(prevAllMetrics.total_inorg_qty || 0);
    const prevAllNeno = parseFloat(prevAllMetrics.total_neno || 0);
    const prevAllDeno = parseFloat(prevAllMetrics.total_deno || 0);

    const prevAllPromoMyBrand = parseFloat(prevAllMetrics.my_mrp_val || 0) > 0
        ? ((parseFloat(prevAllMetrics.my_mrp_val) - parseFloat(prevAllMetrics.my_actual_sales)) / parseFloat(prevAllMetrics.my_mrp_val)) * 100
        : 0;
    const prevAllPromoCompete = parseFloat(prevAllMetrics.comp_mrp_val || 0) > 0
        ? ((parseFloat(prevAllMetrics.comp_mrp_val) - parseFloat(prevAllMetrics.comp_actual_sales)) / parseFloat(prevAllMetrics.comp_mrp_val)) * 100
        : 0;

    const prevAllAvailability = prevAllDeno > 0 ? (prevAllNeno / prevAllDeno) * 100 : 0;
    const prevAllRoas = prevAllSpend > 0 ? prevAllAdSales / prevAllSpend : 0;
    const prevAllConversion = prevAllClicks > 0 ? (prevAllOrders / prevAllClicks) * 100 : 0;
    const prevAllCpm = prevAllImpressions > 0 ? (prevAllSpend / prevAllImpressions) * 1000 : 0;
    const prevAllCpc = prevAllClicks > 0 ? prevAllSpend / prevAllClicks : 0;
    const prevAllInorgSales = prevAllAdSales;

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

    platformDefinitions.forEach(p => {
        const key = p.label.toLowerCase();
        sumMsNum += currMsNumMap.get(key) || 0;
        sumMsDenom += currMsDenomMap.get(key) || 0;
        prevSumMsNum += prevMsNumMap.get(key) || 0;
        prevSumMsDenom += prevMsDenomMap.get(key) || 0;
    });

    const allMarketShare = await getMarketShare(startDate, endDate, 'All', rawCategory, null, locationArr);
    const prevAllMarketShare = await getMarketShare(momStart, momEnd, 'All', rawCategory, null, locationArr);

    platformOverview.push({
        key: 'all',
        label: 'All',
        type: 'Overall',
        logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
        columns: generateKpiColumns({
            offtake: allOfftake, availability: allAvailability, sos: allSos, marketShare: allMarketShare, spend: allSpend, roas: allRoas, inorgSales: allInorgSales, conversion: allConversion, cpm: allCpm, cpc: allCpc, promoMyBrand: allPromoMyBrand, promoCompete: allPromoCompete, categorySize: sumCatSize, adSov: allAdSov, organicSov: allOrganicSov,
            prevOfftake: prevAllOfftake, prevAvailability: prevAllAvailability, prevSos: prevAllSos, prevMarketShare: prevAllMarketShare, prevSpend: prevAllSpend, prevRoas: prevAllRoas, prevInorgSales: prevAllInorgSales, prevConversion: prevAllConversion, prevCpm: prevAllCpm, prevCpc: prevAllCpc, prevPromoMyBrand: prevAllPromoMyBrand, prevPromoCompete: prevAllPromoCompete, prevCategorySize: prevSumCatSize, prevAdSov: prevAllAdSov, prevOrganicSov: prevAllOrganicSov,
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
        const allRow = platformOverview[0];
        if (allRow && allRow.key === 'all' && allRow.columns) {
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

    // Process each platform from bulk data
    for (const p of platformDefinitions) {
        const metrics = bulkPlatformMap.get(p.label) || { curr: {}, prev: {} };

        const offtake = metrics.curr.sales || 0;
        const offtakeUnits = metrics.curr.qty || 0;
        const totalSpend = metrics.curr.spend || 0;
        const totalAdSales = metrics.curr.adSales || 0;
        const inorgUnits = metrics.curr.orders || 0; // Using orders as units for Inorg Sales
        const totalClicks = metrics.curr.clicks || 0;
        const totalImpressions = metrics.curr.impressions || 0;
        const totalOrders = metrics.curr.orders || 0;

        // Hardcode Market Share values as requested by user
        const marketShare = await getMarketShare(startDate, endDate, p.label, rawCategory, null, locationArr);

        const sos = metrics.curr.sos || 0;
        const adSov = metrics.curr.adSov || 0;
        const organicSov = metrics.curr.organicSov || 0;

        const availability = metrics.curr.deno > 0 ? (metrics.curr.neno / metrics.curr.deno) * 100 : 0;
        const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;
        // Conversion = (Orders / Clicks) * 100
        const conversion = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;
        const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const inorgSales = totalAdSales;

        const promoMyBrand = (metrics.curr.myMrpVal || 0) > 0
            ? ((metrics.curr.myMrpVal - metrics.curr.myActualSales) / metrics.curr.myMrpVal) * 100
            : 0;
        const promoCompete = (metrics.curr.compMrpVal || 0) > 0
            ? ((metrics.curr.compMrpVal - metrics.curr.compActualSales) / metrics.curr.compMrpVal) * 100
            : 0;

        // Previous period
        const prevOfftake = metrics.prev.sales || 0;
        const prevOfftakeUnits = metrics.prev.qty || 0;
        const prevSpend = metrics.prev.spend || 0;
        const prevAdSales = metrics.prev.adSales || 0;
        const prevInorgUnits = metrics.prev.orders || 0;
        const prevMarketShare = await getMarketShare(momStart, momEnd, p.label, rawCategory, null, locationArr);
        const prevSos = metrics.prev.sos || 0;
        const prevAdSov = metrics.prev.adSov || 0;
        const prevOrganicSov = metrics.prev.organicSov || 0;
        const prevImpressions = metrics.prev.impressions || 0;
        const prevClicks = metrics.prev.clicks || 0;
        const prevOrders = metrics.prev.orders || 0;
        const prevAvailability = metrics.prev.deno > 0 ? (metrics.prev.neno / metrics.prev.deno) * 100 : 0;
        const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
        // Conversion = (Orders / Clicks) * 100
        const prevConversion = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
        const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
        const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;
        const prevInorgSales = prevAdSales;

        const prevPromoMyBrand = (metrics.prev.myMrpVal || 0) > 0
            ? ((metrics.prev.myMrpVal - metrics.prev.myActualSales) / metrics.prev.myMrpVal) * 100
            : 0;
        const prevPromoCompete = (metrics.prev.compMrpVal || 0) > 0
            ? ((metrics.prev.compMrpVal - metrics.prev.compActualSales) / metrics.prev.compMrpVal) * 100
            : 0;

        // Fuzzy match category size from the maps
        const fuzzyGet = (map, label) => {
            const lowerLabel = label.toLowerCase();
            if (map.has(lowerLabel)) return map.get(lowerLabel);
            for (const [mk, mv] of map.entries()) {
                if (mk.includes(lowerLabel) || lowerLabel.includes(mk)) return mv;
            }
            return 0;
        };

        const currCatSizeAbsolute = fuzzyGet(currCatSizeByPlatformMap, p.label);
        const prevCatSizeAbsolute = fuzzyGet(prevCatSizeByPlatformMap, p.label);

        platformOverview.push({
            key: p.key,
            label: p.label,
            type: p.type,
            logo: p.logo,
            columns: generateKpiColumns({
                offtake, availability, sos, marketShare, spend: totalSpend, roas, inorgSales, conversion, cpm, cpc, promoMyBrand, promoCompete, categorySize: currCatSizeAbsolute, adSov, organicSov,
                prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete, prevCategorySize: prevCatSizeAbsolute, prevAdSov, prevOrganicSov,
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

    const { months = 1, startDate: qStartDate, endDate: qEndDate, monthOverviewPlatform, channel, skuName, skuCode } = filters;

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
    const src = await getWatchtowerSource();
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Build offtake conditions - using fetchStartDate for historical data
    const buildMoConds = () => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${fetchStartDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        const platformCond = buildPlatformChannelCond(moPlatform, channel, src.f.platform);
        if (platformCond) conds.push(platformCond);
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `${src.f.brand} LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
        }
        if (locationArr && locationArr.length > 0) {
            conds.push(`${src.f.location} IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
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
            conds.push(`location_name IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    const moConds = buildMoConds();
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
            conds.push(`location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    const msNumMoConds = buildMsMoConds(brandsForMonthMs);
    const msDenomMoConds = buildMsMoConds(null);

    // ⚡ OPTIMIZED: Run all queries in PARALLEL with ClickHouse
    // ⚡ OPTIMIZED: Run all queries in PARALLEL with ClickHouse
    const [monthlyData, sosNumMonth, sosDenomMonth, msMonthData, catSizeMonth, adSovNumMonth, adSovDenomMonth, orgSovNumMonth, orgSovDenomMonth] = await Promise.all([
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(${src.f.date}), '%Y-%m-01') as month_date,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.quantitySold} ELSE 0 END) as total_qty,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 AND ${src.f.mrp} > 0 THEN ${src.f.mrp} * ${src.f.quantitySold} ELSE 0 END) as my_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlag} = 0 AND ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} * ${src.f.quantitySold} ELSE 0 END) as my_actual_sales,
                        SUM(CASE WHEN ${src.f.compFlag} = 1 AND ${src.f.mrp} > 0 THEN ${src.f.mrp} * ${src.f.quantitySold} ELSE 0 END) as comp_mrp_val,
                        SUM(CASE WHEN ${src.f.compFlag} = 1 AND ${src.f.mrp} > 0 THEN ${src.f.sellingPrice} * ${src.f.quantitySold} ELSE 0 END) as comp_actual_sales
                    FROM ${src.table}
                    WHERE ${moConds}
                    GROUP BY formatDateTime(toDate(${src.f.date}), '%Y-%m-01')
                `),
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(DATE), '%Y-%m-01') as month_date,
                        countIf(toInt32(overall) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                `),
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(DATE), '%Y-%m-01') as month_date,
                        count() as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                `),
        getMarketShareByMonth(fetchStartDate, endDate, moPlatform, rawCategory, null, locationArr),
        // Category Size by month
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(created_on), '%Y-%m-01') as month_date,
                        SUM(toFloat64OrZero(toString(sales))) as cat_size
                    FROM rb_ms_olap
                    WHERE ${msDenomMoConds}
                    GROUP BY formatDateTime(toDate(created_on), '%Y-%m-01')
                `),
        // Spons SOS (Ad SOV) numerator by month (countIf(spons=1), flag=0 for our brands)
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(DATE), '%Y-%m-01') as month_date,
                        countIf(toInt32(spons) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                `),
        // Spons SOS (Ad SOV) denominator by month (total count)
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(DATE), '%Y-%m-01') as month_date,
                        count() as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                `),
        // Organic SOS numerator by month (countIf(organic=1), flag=0 for our brands)
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(DATE), '%Y-%m-01') as month_date,
                        countIf(toInt32(organic) = 1 AND toString(flag) = '1') as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                `),
        // Organic SOS denominator by month (total count)
        queryClickHouse(`
                    SELECT 
                        formatDateTime(toDate(DATE), '%Y-%m-01') as month_date,
                        count() as count
                    FROM rb_kw_olap
                    WHERE ${sosMoConds}
                    GROUP BY formatDateTime(toDate(DATE), '%Y-%m-01')
                `)
    ]);

    const sosNumMonthMap = new Map(sosNumMonth.map(r => [r.month_date, parseInt(r.count) || 0]));
    const sosDenomMonthMap = new Map(sosDenomMonth.map(r => [r.month_date, parseInt(r.count) || 0]));
    const msMonthMap = new Map(msMonthData.map(r => [r.month_date, parseFloat(r.avg_market_share || 0)]));
    const catSizeMonthMap = new Map(catSizeMonth.map(r => [r.month_date, parseFloat(r.cat_size || 0)]));
    const dataMap = new Map(monthlyData.map(d => [d.month_date, d]));

    // Ad SOV and Organic SOV maps by month
    const adSovNumMonthMap = new Map(adSovNumMonth.map(r => [r.month_date, parseInt(r.count) || 0]));
    const adSovDenomMonthMap = new Map(adSovDenomMonth.map(r => [r.month_date, parseInt(r.count) || 0]));
    const orgSovNumMonthMap = new Map(orgSovNumMonth.map(r => [r.month_date, parseInt(r.count) || 0]));
    const orgSovDenomMonthMap = new Map(orgSovDenomMonth.map(r => [r.month_date, parseInt(r.count) || 0]));

    const monthOverview = monthBuckets.map(bucket => {
        const monthKey = dayjs(bucket.date).format('YYYY-MM-01');
        const data = dataMap.get(monthKey) || {};

        const offtake = parseFloat(data.total_sales || 0);
        const offtakeUnits = parseFloat(data.total_qty || 0);
        const spend = parseFloat(data.total_spend || 0);
        const adSales = parseFloat(data.total_ad_sales || 0);
        const inorgUnits = parseFloat(data.total_orders || 0);
        const clicks = parseFloat(data.total_clicks || 0);
        const impressions = parseFloat(data.total_impressions || 0);
        const orders = parseFloat(data.total_orders || 0);
        const neno = parseFloat(data.total_neno || 0);
        const deno = parseFloat(data.total_deno || 0);

        const availability = deno > 0 ? (neno / deno) * 100 : 0;
        const roas = spend > 0 ? adSales / spend : 0;
        const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;

        const marketShare = msMonthMap.get(monthKey) || 0;

        const sosNum = sosNumMonthMap.get(monthKey) || 0;
        const sosDenom = sosDenomMonthMap.get(monthKey) || 0;
        const sos = sosDenom > 0 ? (sosNum / sosDenom) * 100 : 0;

        // Metrics for PREVIOUS month for change calculation
        const prevMonthKey = dayjs(bucket.date).subtract(1, 'month').format('YYYY-MM-01');
        const prevData = dataMap.get(prevMonthKey) || {};

        const prevOfftake = parseFloat(prevData.total_sales || 0);
        const prevOfftakeUnits = parseFloat(prevData.total_qty || 0);
        const prevSpend = parseFloat(prevData.total_spend || 0);
        const prevAdSales = parseFloat(prevData.total_ad_sales || 0);
        const prevInorgUnits = parseFloat(prevData.total_orders || 0);
        const prevClicks = parseFloat(prevData.total_clicks || 0);
        const prevImpressions = parseFloat(prevData.total_impressions || 0);
        const prevOrders = parseFloat(prevData.total_orders || 0);
        const prevNeno = parseFloat(prevData.total_neno || 0);
        const prevDeno = parseFloat(prevData.total_deno || 0);

        const prevAvailability = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;
        const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
        const prevConversion = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
        const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
        const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

        const promoMyBrand = parseFloat(data.my_mrp_val || 0) > 0
            ? ((parseFloat(data.my_mrp_val) - parseFloat(data.my_actual_sales)) / parseFloat(data.my_mrp_val)) * 100
            : 0;
        const promoCompete = parseFloat(data.comp_mrp_val || 0) > 0
            ? ((parseFloat(data.comp_mrp_val) - parseFloat(data.comp_actual_sales)) / parseFloat(data.comp_mrp_val)) * 100
            : 0;
        const prevPromoMyBrand = parseFloat(prevData.my_mrp_val || 0) > 0
            ? ((parseFloat(prevData.my_mrp_val) - parseFloat(prevData.my_actual_sales)) / parseFloat(prevData.my_mrp_val)) * 100
            : 0;
        const prevPromoCompete = parseFloat(prevData.comp_mrp_val || 0) > 0
            ? ((parseFloat(prevData.comp_mrp_val) - parseFloat(prevData.comp_actual_sales)) / parseFloat(prevData.comp_mrp_val)) * 100
            : 0;

        const prevMarketShare = msMonthMap.get(prevMonthKey) || 0;

        const prevSosNum = sosNumMonthMap.get(prevMonthKey) || 0;
        const prevSosDenom = sosDenomMonthMap.get(prevMonthKey) || 0;
        const prevSos = prevSosDenom > 0 ? (prevSosNum / prevSosDenom) * 100 : 0;

        // Ad SOV (spons_flag=1)
        const adSovNum = adSovNumMonthMap.get(monthKey) || 0;
        const adSovDenom = adSovDenomMonthMap.get(monthKey) || 0;
        const adSov = adSovDenom > 0 ? (adSovNum / adSovDenom) * 100 : 0;
        const prevAdSovNum = adSovNumMonthMap.get(prevMonthKey) || 0;
        const prevAdSovDenom = adSovDenomMonthMap.get(prevMonthKey) || 0;
        const prevAdSov = prevAdSovDenom > 0 ? (prevAdSovNum / prevAdSovDenom) * 100 : 0;

        // Organic SOV (spons_flag=0)
        const orgSovNum = orgSovNumMonthMap.get(monthKey) || 0;
        const orgSovDenom = orgSovDenomMonthMap.get(monthKey) || 0;
        const organicSov = orgSovDenom > 0 ? (orgSovNum / orgSovDenom) * 100 : 0;
        const prevOrgSovNum = orgSovNumMonthMap.get(prevMonthKey) || 0;
        const prevOrgSovDenom = orgSovDenomMonthMap.get(prevMonthKey) || 0;
        const prevOrganicSov = prevOrgSovDenom > 0 ? (prevOrgSovNum / prevOrgSovDenom) * 100 : 0;

        return {
            key: bucket.label,
            label: bucket.label,
            date: bucket.date,
            type: bucket.label,
            logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
            columns: generateKpiColumns({
                offtake, availability, sos, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, promoMyBrand, promoCompete, categorySize: catSizeMonthMap.get(monthKey) || 0, adSov, organicSov,
                prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete, prevCategorySize: catSizeMonthMap.get(prevMonthKey) || 0, prevAdSov, prevOrganicSov,
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

    const { months = 1, startDate: qStartDate, endDate: qEndDate, categoryOverviewPlatform, channel, skuName, skuCode } = filters;

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
    const src = await getWatchtowerSource();



    // Helper to escape strings for ClickHouse
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Build category conditions for rb_pdp_olap
    const buildCatConds = (sDate, eDate) => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];

        const platformCol = src.isAgg ? 'platform' : 'Platform';
        const platformCond = buildPlatformChannelCond(catPlatform, channel, platformCol);
        if (platformCond) conds.push(platformCond);

        const brandCol = src.isAgg ? 'brand' : 'Brand';
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `LOWER(${brandCol}) LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
        }

        const locCol = src.isAgg ? 'location' : 'Location';
        if (locationArr && locationArr.length > 0) {
            conds.push(`${locCol} IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
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
        }

        return conds.join(' AND ');
    };

    // Build SOS conditions for rb_kw_olap
    const buildSosCatConds = (sDate, eDate) => {
        const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const pCond = buildPlatformChannelCond(catPlatform, channel, 'platform_name');
        if (pCond) conds.push(pCond);
        if (locationArr && locationArr.length > 0) {
            conds.push(`location_name IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        if (brandArr && brandArr.length > 0) {
            conds.push(`LOWER(brand_name_th) IN (${brandArr.map(b => `'${escapeStr(b)}'`).join(', ')})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`LOWER(keyword_category) IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    // Build MS conditions for rb_brand_ms
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
            conds.push(`location IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`LOWER(category) IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    // Get valid brand names for MS
    const validBrandNamesFromCache = await getCachedValidBrandNames();
    const validBrandNamesForCat = (brandArr && brandArr.length > 0) ? brandArr : validBrandNamesFromCache;

    // ⚡ RUN ALL QUERIES IN PARALLEL
    const [
        distinctCategories,
        currCatData, prevCatData,
        currSosData, prevSosData,
        currMsNum, currMsDenom, prevMsNum, prevMsDenom,
        currCatSizeByCat, prevCatSizeByCat,
        currAdSovData, prevAdSovData,
        currOrgSovData, prevOrgSovData
    ] = await Promise.all([
        // Query 1: Distinct categories
        queryClickHouse(`
            SELECT DISTINCT ${src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL} as category
            FROM ${src.table}
            WHERE ${buildCatConds(startDate, endDate)} AND ${src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL} != 'Others'
        `),
        // Metrics
        queryClickHouse(`SELECT ${src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL} as Category, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales 
        FROM ${src.table} WHERE ${buildCatConds(startDate, endDate)} GROUP BY Category`),
        queryClickHouse(`SELECT ${src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL} as Category, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} * ${src.f.qty} ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales 
        FROM ${src.table} WHERE ${buildCatConds(momStart, momEnd)} GROUP BY Category`),
        // SOS Current - Simple countIf(overall=1) / count() per category
        queryClickHouse(`
            SELECT keyword_category, countIf(toInt32(overall) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosCatConds(startDate, endDate)}
            GROUP BY keyword_category
        `),
        // SOS Previous
        queryClickHouse(`
            SELECT keyword_category, countIf(toInt32(overall) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosCatConds(momStart, momEnd)}
            GROUP BY keyword_category
        `),
        // Market Share
        queryClickHouse(`SELECT category, SUM(toFloat64OrZero(toString(sales))) as our_sales FROM rb_ms_olap WHERE ${buildMsCatConds(startDate, endDate, validBrandNamesForCat)} GROUP BY category`),
        queryClickHouse(`SELECT category, SUM(toFloat64OrZero(toString(sales))) as total_sales FROM rb_ms_olap WHERE ${buildMsCatConds(startDate, endDate, null)} GROUP BY category`),
        queryClickHouse(`SELECT category, SUM(toFloat64OrZero(toString(sales))) as our_sales FROM rb_ms_olap WHERE ${buildMsCatConds(momStart, momEnd, validBrandNamesForCat)} GROUP BY category`),
        queryClickHouse(`SELECT category, SUM(toFloat64OrZero(toString(sales))) as total_sales FROM rb_ms_olap WHERE ${buildMsCatConds(momStart, momEnd, null)} GROUP BY category`),
        // Category Size
        queryClickHouse(`
                    SELECT category, SUM(toFloat64OrZero(toString(sales))) as cat_size
                    FROM rb_ms_olap
                    WHERE ${buildMsCatConds(startDate, endDate, null)}
                    GROUP BY category
                `),
        queryClickHouse(`
                    SELECT category, SUM(toFloat64OrZero(toString(sales))) as cat_size
                    FROM rb_ms_olap
                    WHERE ${buildMsCatConds(momStart, momEnd, null)}
                    GROUP BY category
                `),
        // Spons SOS (Ad SOV) Current - countIf(spons=1) per category
        queryClickHouse(`
            SELECT keyword_category, countIf(toInt32(spons) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosCatConds(startDate, endDate)}
            GROUP BY keyword_category
        `),
        // Spons SOS (Ad SOV) Previous
        queryClickHouse(`
            SELECT keyword_category, countIf(toInt32(spons) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosCatConds(momStart, momEnd)}
            GROUP BY keyword_category
        `),
        // Organic SOS Current - countIf(organic=1) per category
        queryClickHouse(`
            SELECT keyword_category, countIf(toInt32(organic) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosCatConds(startDate, endDate)}
            GROUP BY keyword_category
        `),
        // Organic SOS Previous
        queryClickHouse(`
            SELECT keyword_category, countIf(toInt32(organic) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosCatConds(momStart, momEnd)}
            GROUP BY keyword_category
        `)
    ]);

    const categories = distinctCategories.map(c => c.category).filter(Boolean);

    // Build maps for efficient lookup
    const buildMap = (data, keyField, valField) => new Map(data.map(r => [r[keyField]?.toLowerCase(), r[valField]]));
    const currCatMap = new Map(currCatData.map(d => [d.Category?.toLowerCase(), d]));
    const prevCatMap = new Map(prevCatData.map(d => [d.Category?.toLowerCase(), d]));

    const buildSosMap = (data) => new Map(data.map(r => [r.keyword_category?.toLowerCase(), { num: parseInt(r.num), den: parseInt(r.den) }]));

    const currSosMap = buildSosMap(currSosData);
    const prevSosMap = buildSosMap(prevSosData);

    // Ad SOV and Organic SOV maps
    const currAdSovMap = buildSosMap(currAdSovData);
    const prevAdSovMap = buildSosMap(prevAdSovData);
    const currOrgSovMap = buildSosMap(currOrgSovData);
    const prevOrgSovMap = buildSosMap(prevOrgSovData);

    const currMsNumMap = buildMap(currMsNum, 'category', 'our_sales');
    const currMsDenomMap = buildMap(currMsDenom, 'category', 'total_sales');
    const prevMsNumMap = buildMap(prevMsNum, 'category', 'our_sales');
    const prevMsDenomMap = buildMap(prevMsDenom, 'category', 'total_sales');
    const currCatSizeCatMap = buildMap(currCatSizeByCat, 'category', 'cat_size');
    const prevCatSizeCatMap = buildMap(prevCatSizeByCat, 'category', 'cat_size');

    // Calculate total Category Size across all computed categories to use as denominator for percentage
    const totalCurrCatSize = currCatSizeByCat.reduce((sum, row) => sum + parseFloat(row.cat_size || 0), 0);
    const totalPrevCatSize = prevCatSizeByCat.reduce((sum, row) => sum + parseFloat(row.cat_size || 0), 0);

    const categoryOverviewPromises = categories.map(async (catName) => {
        const catKey = catName?.toLowerCase();
        let currRaw = currCatMap.get(catKey) || {};
        let prevRaw = prevCatMap.get(catKey) || {};

        // Scale Mars metrics
        const curr = scaleMarsMetrics(currRaw, catName);
        const prev = scaleMarsMetrics(prevRaw, catName);

        const offtake = parseFloat(curr.total_sales || 0);
        const offtakeUnits = parseFloat(curr.total_qty || 0);
        const spend = parseFloat(curr.total_spend || 0);
        const adSales = parseFloat(curr.total_ad_sales || 0);
        const clicks = parseFloat(curr.total_clicks || 0);
        const impressions = parseFloat(curr.total_impressions || 0);
        const orders = parseFloat(curr.total_orders || 0);
        const availability = curr.total_deno > 0 ? (curr.total_neno / curr.total_deno) * 100 : 0;
        const roas = spend > 0 ? adSales / spend : 0;
        const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;

        const sosDataObj = currSosMap.get(catKey) || { num: 0, den: 0 };
        const sos = sosDataObj.den > 0 ? (sosDataObj.num / sosDataObj.den) * 100 : 0;

        // Market Share via marketShareHelper — no platform filter on rb_brand_ms
        // (rb_brand_ms platform values may differ; category filter is the key discriminator)
        const marketShare = await getMarketShare(startDate, endDate, null, [catName], null, locationArr);

        // Previous
        const prevOfftake = parseFloat(prev.total_sales || 0);
        const prevOfftakeUnits = parseFloat(prev.total_qty || 0);
        const prevSpend = parseFloat(prev.total_spend || 0);
        const prevAdSales = parseFloat(prev.total_ad_sales || 0);
        const prevOrders = parseFloat(prev.total_orders || 0);
        const prevClicks = parseFloat(prev.total_clicks || 0);
        const prevImpressions = parseFloat(prev.total_impressions || 0);
        const prevAvailability = prev.total_deno > 0 ? (prev.total_neno / prev.total_deno) * 100 : 0;
        const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
        const prevConversion = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
        const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
        const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

        const prevSosDataObj = prevSosMap.get(catKey) || { num: 0, den: 0 };
        const prevSos = prevSosDataObj.den > 0 ? (prevSosDataObj.num / prevSosDataObj.den) * 100 : 0;

        const prevMarketShare = await getMarketShare(momStart, momEnd, null, [catName], null, locationArr);

        const promoMyBrand = parseFloat(curr.my_mrp_val || 0) > 0
            ? ((parseFloat(curr.my_mrp_val) - parseFloat(curr.my_actual_sales)) / parseFloat(curr.my_mrp_val)) * 100
            : 0;
        const promoCompete = parseFloat(curr.comp_mrp_val || 0) > 0
            ? ((parseFloat(curr.comp_mrp_val) - parseFloat(curr.comp_actual_sales)) / parseFloat(curr.comp_mrp_val)) * 100
            : 0;
        const prevPromoMyBrand = parseFloat(prev.my_mrp_val || 0) > 0
            ? ((parseFloat(prev.my_mrp_val) - parseFloat(prev.my_actual_sales)) / parseFloat(prev.my_mrp_val)) * 100
            : 0;
        const prevPromoCompete = parseFloat(prev.comp_mrp_val || 0) > 0
            ? ((parseFloat(prev.comp_mrp_val) - parseFloat(prev.comp_actual_sales)) / parseFloat(prev.comp_mrp_val)) * 100
            : 0;

        // Ad SOV (spons_flag=1)
        const adSovDataObj = currAdSovMap.get(catKey) || { num: 0, den: 0 };
        const adSov = adSovDataObj.den > 0 ? (adSovDataObj.num / adSovDataObj.den) * 100 : 0;
        const prevAdSovDataObj = prevAdSovMap.get(catKey) || { num: 0, den: 0 };
        const prevAdSov = prevAdSovDataObj.den > 0 ? (prevAdSovDataObj.num / prevAdSovDataObj.den) * 100 : 0;

        // Organic SOV (spons_flag=0)
        const orgSovDataObj = currOrgSovMap.get(catKey) || { num: 0, den: 0 };
        const organicSov = orgSovDataObj.den > 0 ? (orgSovDataObj.num / orgSovDataObj.den) * 100 : 0;
        const prevOrgSovDataObj = prevOrgSovMap.get(catKey) || { num: 0, den: 0 };
        const prevOrganicSov = prevOrgSovDataObj.den > 0 ? (prevOrgSovDataObj.num / prevOrgSovDataObj.den) * 100 : 0;

        const currCatSizeAbsolute = currCatSizeCatMap.get(catKey) || 0;
        const prevCatSizeAbsolute = prevCatSizeCatMap.get(catKey) || 0;

        return {
            key: catName,
            label: catName,
            type: catName,
            logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
            columns: generateKpiColumns({
                offtake, availability, sos, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, promoMyBrand, promoCompete, categorySize: currCatSizeAbsolute, adSov, organicSov,
                prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete, prevCategorySize: prevCatSizeAbsolute, prevAdSov, prevOrganicSov,
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

    const { months = 1, startDate: qStartDate, endDate: qEndDate, brandsOverviewPlatform, brandsOverviewCategory, channel } = filters;

    // Extract filter values - frontend may send as 'location' or 'location[]' (array format)
    const rawLocation = filters['location[]'] || filters.location;

    // Normalize multi-value filters
    const locationArr = normalizeFilterArray(rawLocation);
    const location = locationArr ? (locationArr.length === 1 ? locationArr[0] : locationArr) : null;

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
    const src = await getWatchtowerSource();



    // Helper to escape strings for ClickHouse
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

    // Build brand conditions for rb_pdp_olap
    const buildBrandConds = (sDate, eDate) => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];

        const platformCol = src.isAgg ? 'platform' : 'Platform';
        const platformCond = buildPlatformChannelCond(boPlatform, channel, platformCol);
        if (platformCond) conds.push(platformCond);

        const catCol = src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL;
        const categoryArr = normalizeFilterArray(boCategory);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`${catCol} IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        const locCol = src.isAgg ? 'location' : 'Location';
        if (locationArr && locationArr.length > 0) {
            conds.push(`${locCol} IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
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
        }

        return conds.join(' AND ');
    };

    // Build SOS conditions for rb_kw_olap
    const buildSosBrandConds = (sDate, eDate) => {
        const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const platformArr = normalizeFilterArray(boPlatform);
        const pCond = buildPlatformChannelCond(boPlatform, channel, 'platform_name');
        if (pCond) conds.push(pCond);
        const categoryArr = normalizeFilterArray(boCategory);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`keyword_category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        const locArr = normalizeFilterArray(location);
        if (locArr && locArr.length > 0) {
            conds.push(`location_name IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
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
            conds.push(`location IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };
    // Get valid brand names for MS
    const validBrandNames = await getCachedValidBrandNames();

    // ⚡ RUN ALL QUERIES IN PARALLEL
    const [
        brandsData,
        currSosData, prevSosData,
        currBrandsMetrics, prevBrandsMetrics,
        currMsMap, prevMsMap,
        currCatSizeTotal, prevCatSizeTotal,
        currAdSovData, prevAdSovData,
        currOrgSovData, prevOrgSovData
    ] = await Promise.all([
        queryClickHouse(`SELECT DISTINCT brand_name FROM rca_sku_dim WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL AND brand_name != ''`),
        // SOS Current - Simple countIf(overall=1) per brand
        queryClickHouse(`
            SELECT brand_name_th as brand_name, countIf(toInt32(overall) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosBrandConds(startDate, endDate)}
            GROUP BY brand_name_th
        `),
        // SOS Previous
        queryClickHouse(`
            SELECT brand_name_th as brand_name, countIf(toInt32(overall) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosBrandConds(momStart, momEnd)}
            GROUP BY brand_name_th
        `),
        // Metrics from rb_pdp_olap
        queryClickHouse(`SELECT ${src.isAgg ? 'brand' : 'Brand'} as Brand, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales
        FROM ${src.table} WHERE ${buildBrandConds(startDate, endDate)} GROUP BY Brand`),
        queryClickHouse(`SELECT ${src.isAgg ? 'brand' : 'Brand'} as Brand, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno, 
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales
        FROM ${src.table} WHERE ${buildBrandConds(momStart, momEnd)} GROUP BY Brand`),
        // Optimized Market Share from helpers
        getMarketShareByBrand(startDate, endDate, boPlatform, boCategory, null, locationArr),
        getMarketShareByBrand(momStart, momEnd, boPlatform, boCategory, null, locationArr),
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
                `),
        // Spons SOS (Ad SOV) Current - countIf(spons=1) per brand
        queryClickHouse(`
            SELECT brand_name_th as brand_name, countIf(toInt32(spons) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosBrandConds(startDate, endDate)}
            GROUP BY brand_name_th
        `),
        // Spons SOS (Ad SOV) Previous
        queryClickHouse(`
            SELECT brand_name_th as brand_name, countIf(toInt32(spons) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosBrandConds(momStart, momEnd)}
            GROUP BY brand_name_th
        `),
        // Organic SOS Current - countIf(organic=1) per brand
        queryClickHouse(`
            SELECT brand_name_th as brand_name, countIf(toInt32(organic) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosBrandConds(startDate, endDate)}
            GROUP BY brand_name_th
        `),
        // Organic SOS Previous
        queryClickHouse(`
            SELECT brand_name_th as brand_name, countIf(toInt32(organic) = 1 AND toString(flag) = '1') as num, count() as den
            FROM rb_kw_olap WHERE ${buildSosBrandConds(momStart, momEnd)}
            GROUP BY brand_name_th
        `)
    ]);

    const brands = brandsData.map(d => d.brand_name).filter(Boolean);
    const currBrandCatSize = parseFloat(currCatSizeTotal[0]?.cat_size || 0);
    const prevBrandCatSize = parseFloat(prevCatSizeTotal[0]?.cat_size || 0);

    const buildMap = (data, keyField, valField) => new Map(data.map(r => [r[keyField]?.toLowerCase(), r[valField]]));
    const currMetricMap = new Map(currBrandsMetrics.map(d => [d.Brand?.toLowerCase(), d]));
    const prevMetricMap = new Map(prevBrandsMetrics.map(d => [d.Brand?.toLowerCase(), d]));

    const buildSosMap = (data) => new Map(data.map(r => [r.brand_name?.toLowerCase(), { num: parseInt(r.num), den: parseInt(r.den) }]));

    const currSosMap = buildSosMap(currSosData);
    const prevSosMap = buildSosMap(prevSosData);

    // Ad SOV and Organic SOV maps
    const currAdSovMap = buildSosMap(currAdSovData);
    const prevAdSovMap = buildSosMap(prevAdSovData);
    const currOrgSovMap = buildSosMap(currOrgSovData);
    const prevOrgSovMap = buildSosMap(prevOrgSovData);


    const brandsOverview = brands.map(brandName => {
        const brandKey = brandName.toLowerCase();
        let currRaw = currMetricMap.get(brandKey) || {};
        let prevRaw = prevMetricMap.get(brandKey) || {};

        // Scale Mars metrics
        const curr = scaleMarsMetrics(currRaw, brandName);
        const prev = scaleMarsMetrics(prevRaw, brandName);

        const offtake = parseFloat(curr.total_sales || 0);
        const spend = parseFloat(curr.total_spend || 0);
        const adSales = parseFloat(curr.total_ad_sales || 0);
        const orders = parseFloat(curr.total_orders || 0);
        const clicks = parseFloat(curr.total_clicks || 0);
        const impressions = parseFloat(curr.total_impressions || 0);
        const availability = curr.total_deno > 0 ? (curr.total_neno / curr.total_deno) * 100 : 0;
        const roas = spend > 0 ? adSales / spend : 0;
        const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;

        const promoMyBrand = parseFloat(curr.my_mrp_val || 0) > 0
            ? ((parseFloat(curr.my_mrp_val) - parseFloat(curr.my_actual_sales)) / parseFloat(curr.my_mrp_val)) * 100
            : 0;
        const promoCompete = parseFloat(curr.comp_mrp_val || 0) > 0
            ? ((parseFloat(curr.comp_mrp_val) - parseFloat(curr.comp_actual_sales)) / parseFloat(curr.comp_mrp_val)) * 100
            : 0;

        const sosDataObj = currSosMap.get(brandKey) || { num: 0, den: 0 };
        const sos = sosDataObj.den > 0 ? (sosDataObj.num / sosDataObj.den) * 100 : 0;

        const marketShare = currMsMap.get(brandKey) || 0;

        // Previous
        const prevOfftake = parseFloat(prev.total_sales || 0);
        const prevSpend = parseFloat(prev.total_spend || 0);
        const prevAdSales = parseFloat(prev.total_ad_sales || 0);
        const prevOrders = parseFloat(prev.total_orders || 0);
        const prevClicks = parseFloat(prev.total_clicks || 0);
        const prevImpressions = parseFloat(prev.total_impressions || 0);
        const prevAvailability = prev.total_deno > 0 ? (prev.total_neno / prev.total_deno) * 100 : 0;
        const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
        const prevConversion = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
        const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
        const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

        const prevPromoMyBrand = parseFloat(prev.my_mrp_val || 0) > 0
            ? ((parseFloat(prev.my_mrp_val) - parseFloat(prev.my_actual_sales)) / parseFloat(prev.my_mrp_val)) * 100
            : 0;
        const prevPromoCompete = parseFloat(prev.comp_mrp_val || 0) > 0
            ? ((parseFloat(prev.comp_mrp_val) - parseFloat(prev.comp_actual_sales)) / parseFloat(prev.comp_mrp_val)) * 100
            : 0;

        const prevSosDataObj = prevSosMap.get(brandKey) || { num: 0, den: 0 };
        const prevSos = prevSosDataObj.den > 0 ? (prevSosDataObj.num / prevSosDataObj.den) * 100 : 0;

        const prevMarketShare = prevMsMap.get(brandKey) || 0;

        // Ad SOV (spons_flag=1)
        const adSovDataObj = currAdSovMap.get(brandKey) || { num: 0, den: 0 };
        const adSov = adSovDataObj.den > 0 ? (adSovDataObj.num / adSovDataObj.den) * 100 : 0;
        const prevAdSovDataObj = prevAdSovMap.get(brandKey) || { num: 0, den: 0 };
        const prevAdSov = prevAdSovDataObj.den > 0 ? (prevAdSovDataObj.num / prevAdSovDataObj.den) * 100 : 0;

        // Organic SOV (spons_flag=0)
        const orgSovDataObj = currOrgSovMap.get(brandKey) || { num: 0, den: 0 };
        const organicSov = orgSovDataObj.den > 0 ? (orgSovDataObj.num / orgSovDataObj.den) * 100 : 0;
        const prevOrgSovDataObj = prevOrgSovMap.get(brandKey) || { num: 0, den: 0 };
        const prevOrganicSov = prevOrgSovDataObj.den > 0 ? (prevOrgSovDataObj.num / prevOrgSovDataObj.den) * 100 : 0;

        return {
            key: brandKey.replace(/\s+/g, '_'),
            label: brandName,
            type: "Brand",
            columns: generateKpiColumns({
                offtake, availability, sos, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, promoMyBrand, promoCompete, categorySize: currBrandCatSize, adSov, organicSov,
                prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete, prevCategorySize: prevBrandCatSize, prevAdSov, prevOrganicSov,
                offtakeUnits: offtake / 100, inorgUnits: orders, prevOfftakeUnits: prevOfftake / 100, prevInorgUnits: prevOrders
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

    const { brand, location, platform, category, period, timeStep, startDate: customStart, endDate: customEnd, channel, skuName, skuCode, dimension, dimensionValue } = filters;

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

    console.log(`[getKpiTrends] Date range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

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

    const src = await getWatchtowerSource();
    // 3. Build WHERE conditions for dynamic source
    const buildKpiConds = () => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

        // Handle dimension filter if provided (matching Trends drawer behavior)
        if (dimension && dimensionValue && dimensionValue !== 'All') {
            const dimKey = dimension.toLowerCase();
            const val = dimensionValue;
            if (dimKey === 'platform') conds.push(`${src.f.platform} = '${escapeStr(val)}'`);
            else if (dimKey === 'category' || dimKey === 'format') {
                const catCol = src.f.category;
                conds.push(`${catCol} = '${escapeStr(val)}'`);
            }
            else if (dimKey === 'brand') conds.push(`${src.f.brand} = '${escapeStr(val)}'`);
            else if (dimKey === 'city' || dimKey === 'location') conds.push(`${src.f.location} = '${escapeStr(val)}'`);
        }

        if (catArr && catArr.length > 0) {
            const catCol = src.f.category;
            conds.push(`${catCol} IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }

        if (brandArr && brandArr.length > 0) {
            const brandConditions = brandArr.map(b => `${src.f.brand} LIKE '%${escapeStr(b)}%'`).join(' OR ');
            conds.push(`(${brandConditions})`);
        }

        if (locArr && locArr.length > 0) conds.push(`${src.f.location} IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);

        if (platArr && platArr.length > 0) {
            conds.push(`${src.f.platform} IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
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

        return conds.join(' AND ');
    };

    const kpiConds = buildKpiConds();

    // 4. Query for Inorganic Sales, Conversion, ROAS, BMI/Sales Ratio from dynamic source
    const kpiResults = await queryClickHouse(`
            SELECT 
                ${groupExpression.replace('DATE', src.f.date)} as date_group,
                MAX(toDate(${src.f.date})) as ref_date,
                SUM(${src.f.sales}) as total_sales,
                SUM(${src.f.adSales}) as total_ad_sales,
                SUM(${src.f.spend}) as total_ad_spend,
                SUM(${src.f.orders}) as total_ad_orders,
                SUM(${src.f.clicks}) as total_ad_clicks,
                SUM(${src.f.impressions}) as total_ad_impressions,
                SUM(${src.f.neno}) as total_neno_osa,
                SUM(${src.f.deno}) as total_deno_osa,
                COUNT(DISTINCT ${src.f.skuCode}) as assortment_count,
                AVG(${src.f.sellingPrice}) as avg_selling_price,
                AVG(${src.f.mrp}) as avg_mrp,
                AVG(${src.f.discount}) as avg_discount,
                SUM(${src.f.sellingPrice}) as sum_selling_price,
                0 as sum_weight
            FROM ${src.table}
            WHERE ${kpiConds}
            GROUP BY date_group
            ORDER BY ref_date ASC
        `);

    // 5. Query for Share of Search using ClickHouse
    // Uses overall/spons/organic columns and flag column for our brands

    // Build SOS base conditions (uses DATE and flag columns)
    const buildSosConds = () => {
        const conds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

        if (catArr && catArr.length > 0) conds.push(`keyword_category IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        if (locArr && locArr.length > 0) conds.push(`location_name IN (${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        if (platArr && platArr.length > 0) conds.push(`platform_name IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);

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
    const masterAssortmentConds = [`status = 1`];
    if (catArr && catArr.length > 0) masterAssortmentConds.push(`lower(brand_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
    if (brandArr && brandArr.length > 0) masterAssortmentConds.push(`lower(brand_name) IN (${brandArr.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);

    // Dimension-specific master count (e.g. when opening a specific category row trend)
    if (dimension && dimensionValue && dimensionValue !== 'All') {
        const dimKey = dimension.toLowerCase();
        const val = dimensionValue.toLowerCase();
        if (dimKey === 'category' || dimKey === 'format') masterAssortmentConds.push(`lower(brand_category) = '${escapeStr(val)}'`);
        else if (dimKey === 'brand') masterAssortmentConds.push(`lower(brand_name) = '${escapeStr(val)}'`);
    }

    const masterQuery = `SELECT count(DISTINCT web_pid) as total_master FROM rb_sku_platform WHERE ${masterAssortmentConds.join(' AND ')}`;

    const [sosNumerator, sosDenominator, msTimeSeriesMap, masterResult] = await Promise.all([
        // SOS Numerator (countIf overall=1)
        queryClickHouse(`
                SELECT ${groupExpressionKw} as date_group, countIf(toInt32(overall) = 1) as count
                FROM rb_kw_olap
                WHERE ${sosNumConds.join(' AND ')}
                GROUP BY ${groupExpressionKw}
            `),
        // SOS Denominator
        queryClickHouse(`
                SELECT ${groupExpressionKw} as date_group, count() as count
                FROM rb_kw_olap
                WHERE ${sosDenomConds.join(' AND ')}
                GROUP BY ${groupExpressionKw}
            `),
        // Optimized Market Share Time Series
        getMarketShareTimeSeries(startDate, endDate, platArr, catArr, brandArr, timeStep, locArr),
        // Master Assortment Count
        queryClickHouse(masterQuery)
    ]);

    const masterCount = parseInt(masterResult[0]?.total_master, 10) || 0;

    // 7. Generate time buckets and format data
    const buckets = generateTimeBuckets(startDate, endDate, timeStep);

    const timeSeries = buckets.map((bucket, bucketIndex) => {
        const rowRaw = kpiResults.find(r => String(r.date_group) === String(bucket.groupKey)) || {};
        const row = scaleMarsMetrics(rowRaw, brand || category || skuName || dimensionValue);

        // Extract values
        const totalSales = parseFloat(row.total_sales || 0);
        const adSales = parseFloat(row.total_ad_sales || 0);
        const adSpend = parseFloat(row.total_ad_spend || 0);
        const adOrders = parseFloat(row.total_ad_orders || 0);
        const adClicks = parseFloat(row.total_ad_clicks || 0);

        // Calculate Pricing KPIs
        const avgSellingPrice = parseFloat(row.avg_selling_price || 0);
        const avgMrp = parseFloat(row.avg_mrp || 0);
        const avgDiscount = parseFloat(row.avg_discount || 0);
        const sumSellingPrice = parseFloat(row.sum_selling_price || 0);
        const sumWeight = parseFloat(row.sum_weight || 0);

        const discount = avgDiscount;
        const pricePerUnit = sumWeight > 0 ? sumSellingPrice / sumWeight : 0;
        const asp = avgSellingPrice;
        const rpi = avgMrp > 0 ? (avgSellingPrice / avgMrp) : 0; // Relative Price Index baseline

        // Calculate KPIs
        // 10. Availability (OSA%)
        const nenoOsa = parseFloat(row.total_neno_osa || 0);
        const denoOsa = parseFloat(row.total_deno_osa || 0);
        const availability = denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0;

        // 11. Assortment
        const assortment = parseInt(row.assortment_count || 0, 10);

        // 1. Share of Search
        const sosNum = sosNumerator.find(s => String(s.date_group) === String(bucket.groupKey));
        const sosDen = sosDenominator.find(s => String(s.date_group) === String(bucket.groupKey));
        const numCount = parseInt(sosNum?.count || 0, 10);
        const denCount = parseInt(sosDen?.count || 0, 10);
        const shareOfSearch = denCount > 0 ? (numCount / denCount) * 100 : 0;

        // 2. Inorganic Sales (Ad Sales / Total Sales * 100)
        const inorganicSales = totalSales > 0 ? (adSales / totalSales) * 100 : 0;

        // 3. Conversion (Orders / Clicks * 100)
        const conversion = adClicks > 0 ? (adOrders / adClicks) * 100 : 0;

        // 4. ROAS (Ad Sales / Ad Spend)
        const roas = adSpend > 0 ? adSales / adSpend : 0;

        // 5. BMI/Sales Ratio (Ad Spend / Total Sales * 100)
        const bmiSalesRatio = totalSales > 0 ? (adSpend / totalSales) * 100 : 0;

        // 6. Offtakes (Total Sales) - Return raw value for frontend formatting
        const offtakes = totalSales;

        // 7. Spend (Ad Spend) - Return raw value for frontend formatting
        const spend = adSpend;

        // 8. CPM (Cost Per Thousand Impressions)
        const adImpressions = parseFloat(row.total_ad_impressions || 0);
        const cpm = adImpressions > 0 ? (adSpend / adImpressions) * 1000 : 0;

        // 9. CPC (Cost Per Click)
        const cpc = adClicks > 0 ? adSpend / adClicks : 0;

        const marketShare = msTimeSeriesMap.get(String(bucket.groupKey)) || 0;
        const categoryShare = marketShare;

        // Build data point with all KPIs
        const dataPoint = {
            date: bucket.label,
            // Core 5 KPIs (Performance Matrix)
            ShareOfSearch: parseFloat(shareOfSearch.toFixed(2)),
            InorganicSales: parseFloat(inorganicSales.toFixed(2)),
            Conversion: parseFloat(conversion.toFixed(2)),
            Roas: parseFloat(roas.toFixed(2)),
            BmiSalesRatio: parseFloat(bmiSalesRatio.toFixed(2)),
            // Extended KPIs (Platform/Month/Category/Brand pages)
            Offtakes: parseFloat(offtakes.toFixed(0)),
            Spend: parseFloat(spend.toFixed(0)),
            Availability: parseFloat(availability.toFixed(2)),
            Osa: parseFloat(availability.toFixed(2)),
            Listing: masterCount > 0 ? parseFloat(((assortment / masterCount) * 100).toFixed(2)) : parseFloat(availability.toFixed(2)),
            Assortment: assortment,
            CPM: parseFloat(cpm.toFixed(2)),
            CPC: parseFloat(cpc.toFixed(2)),
            // Pricing KPIs
            Discount: parseFloat(discount.toFixed(2)),
            PricePerUnit: parseFloat(pricePerUnit.toFixed(2)),
            ASP: parseFloat(asp.toFixed(2)),
            RPI: parseFloat(rpi.toFixed(2)),
            // Mapped aliases for frontend compatibility
            ROAS: parseFloat(roas.toFixed(2)),
            SOS: parseFloat(shareOfSearch.toFixed(2)),
            InorgSales: parseFloat(inorganicSales.toFixed(2)),
            MarketShare: parseFloat(marketShare.toFixed(2)),
            marketShare: parseFloat(marketShare.toFixed(2)),
            CategoryShare: parseFloat(categoryShare.toFixed(2)),
            categoryShare: parseFloat(categoryShare.toFixed(2)),
            PromoMyBrand: 0,  // Placeholder
            PromoCompete: 0,  // Placeholder
            DspSales: 0       // Placeholder
        };

        return dataPoint;

    });



    return {
        timeSeries,
        metrics: {
            ShareOfSearch: { enabled: true },
            InorganicSales: { enabled: true },
            Conversion: { enabled: true },
            Roas: { enabled: true },
            BmiSalesRatio: { enabled: true }
        }
    };
};

/**
 * Get dynamic filter options for trends drawer
 * @param {string} filterType - 'platforms'|'categories'|'brands'|'cities'
 * @param {string} platform - Selected platform filter
 * @param {string} brand - Selected brand filter (for cities)
 */
const getTrendsFilterOptions = async ({ filterType, platform, brand }) => {
    try {
        console.log(`[getTrendsFilterOptions] Fetching ${filterType} for platform=${platform}, brand=${brand}`);
        const src = await getWatchtowerSource();

        // Normalize arrays for multi-select support
        const platArr = normalizeFilterArray(platform);
        const brandArr = normalizeFilterArray(brand);

        if (filterType === 'platforms') {
            // Fetch unique platforms
            const query = `SELECT DISTINCT ${src.f.platform} as platform FROM ${src.table} WHERE ${src.f.platform} IS NOT NULL AND ${src.f.platform} != '' ORDER BY platform`;
            const results = await queryClickHouse(query);
            const platformList = results.map(p => p.platform).filter(p => p && p.trim()).sort();
            return { options: [...platformList] };
        }

        if (filterType === 'categories') {
            // Fetch unique categories
            const allowedCategories = ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
            const catCol = src.f.category;
            const conditions = [
                `${catCol} IS NOT NULL`,
                `${catCol} != ''`,
                `${catCol} IN (${allowedCategories.map(c => `'${escapeStrMain(c)}'`).join(',')})`
            ];
            if (platArr && platArr.length > 0) {
                conditions.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStrMain(p.toLowerCase())}'`).join(',')})`);
            }

            const query = `SELECT DISTINCT ${catCol} as category FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY category`;
            const results = await queryClickHouse(query);
            const categoryList = results.map(c => c.category).filter(c => c && c.trim()).sort();
            return { options: [...categoryList] };
        }

        if (filterType === 'brands') {
            // Fetch unique brands
            const conditions = [`${src.f.brand} IS NOT NULL`, `${src.f.brand} != ''`];
            if (platArr && platArr.length > 0) {
                conditions.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStrMain(p.toLowerCase())}'`).join(',')})`);
            }

            const query = `SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY brand`;
            const results = await queryClickHouse(query);
            const brandList = results.map(b => b.brand).filter(b => b && b.trim()).sort();
            return { options: [...brandList] };
        }

        if (filterType === 'cities') {
            // Fetch unique cities (Location)
            const conditions = [`${src.f.location} IS NOT NULL`, `${src.f.location} != ''`];
            if (platArr && platArr.length > 0) {
                conditions.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStrMain(p.toLowerCase())}'`).join(',')})`);
            }
            if (brandArr && brandArr.length > 0) {
                conditions.push(`${src.f.brand} IN (${brandArr.map(b => `'${escapeStrMain(b)}'`).join(',')})`);
            }

            const query = `SELECT DISTINCT ${src.f.location} as city FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY city`;
            const results = await queryClickHouse(query);
            const cityList = results.map(c => c.city).filter(c => c && c.trim()).sort();
            return { options: [...cityList] };
        }

        if (filterType === 'skus') {
            // Fetch unique products
            const conditions = [`${src.f.product} IS NOT NULL`, `${src.f.product} != ''`];
            if (platArr && platArr.length > 0) {
                conditions.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStrMain(p.toLowerCase())}'`).join(',')})`);
            }
            if (brandArr && brandArr.length > 0) {
                conditions.push(`lower(${src.f.brand}) IN (${brandArr.map(b => `'${escapeStrMain(b.toLowerCase())}'`).join(',')})`);
            }

            const query = `SELECT DISTINCT ${src.f.product} as sku FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY sku LIMIT 1000`;
            const results = await queryClickHouse(query);
            const skuList = results.map(s => s.sku).filter(s => s && s.trim()).sort();
            return { options: [...skuList] };
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

        console.log('[getCompetitionData] Filters:', { platform, location, category, brand, sku, period });

        // Calculate date range based on period
        const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
        const days = periodDays[period] || 30;

        const endDate = dayjs();
        const startDate = endDate.clone().subtract(days, 'days');
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

        const src = await getWatchtowerSource();
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

            conds.push(`toString(${src.f.compFlag}) = '1'`);

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
                    SUM(${src.f.adSales}) as total_ad_sales,
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
                    SUM(${src.f.adSales}) as total_ad_sales,
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
                SELECT brand_name_th, countIf(toInt32(overall) = 1) AS overall_neno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
                GROUP BY brand_name_th
            `),
            // Query 10: SOS Deno (Overall) from rb_kw_olap - MoM Period
            queryClickHouse(`
                SELECT COUNT(*) AS overall_deno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${momStartDate.format('YYYY-MM-DD')}' AND '${momEndDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
            `),
            // Query 11: SOS Neno (Per Brand) from rb_kw_olap - MoM Period (countIf overall=1)
            queryClickHouse(`
                SELECT brand_name_th, countIf(toInt32(overall) = 1) AS overall_neno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${momStartDate.format('YYYY-MM-DD')}' AND '${momEndDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
                GROUP BY brand_name_th
            `),
            // Query 12: SKU SOS Neno (Per Product) from rb_kw_olap - Current Period (countIf overall=1)
            queryClickHouse(`
                SELECT keyword_search_product AS Product, countIf(toInt32(overall) = 1) AS overall_neno
                FROM rb_kw_olap
                WHERE toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
                  ${platArr && platArr.length > 0 ? `AND lower(platform_name) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})` : ''}
                  ${locArr && locArr.length > 0 ? `AND lower(location_name) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})` : ''}
                  ${catArr && catArr.length > 0 ? `AND lower(keyword_category) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})` : ''}
                GROUP BY Product
            `),
            // Query 13: SKU SOS Neno (Per Product) from rb_kw_olap - MoM Period (countIf overall=1)
            queryClickHouse(`
                SELECT keyword_search_product AS Product, countIf(toInt32(overall) = 1) AS overall_neno
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
        const sosNenoMap = new Map(sosNenoData.map(r => [r.brand_name_th?.toLowerCase(), parseFloat(r.overall_neno || 0)]));
        const sosDenoPrev = parseFloat(sosDenoDataPrev[0]?.overall_deno || 0);
        const sosNenoMapPrev = new Map(sosNenoDataPrev.map(r => [r.brand_name_th?.toLowerCase(), parseFloat(r.overall_neno || 0)]));

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
        const msMapCurr = await getMarketShareByBrand(startDate, endDate, platform, category, msBrandFilter, location);
        const msMapPrev = await getMarketShareByBrand(momStartDate, momEndDate, platform, category, msBrandFilter, location);

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
                SELECT item_name, SUM(toFloat64OrZero(toString(sales))) as sku_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ')} AND item_name IS NOT NULL AND item_name != ''
                GROUP BY item_name
            `),
            queryClickHouse(`
                SELECT item_name, SUM(toFloat64OrZero(toString(sales))) as sku_sales
                FROM rb_ms_olap
                WHERE ${baseMsConds.join(' AND ').replace(startDate.format('YYYY-MM-DD'), momStartDate.format('YYYY-MM-DD')).replace(endDate.format('YYYY-MM-DD'), momEndDate.format('YYYY-MM-DD'))} AND item_name IS NOT NULL AND item_name != ''
                GROUP BY item_name
            `)
        ]);
        const skuSalesMap = new Map(skuSalesQuery.map(r => [r.item_name?.toLowerCase(), parseFloat(r.sku_sales || 0)]));
        const skuSalesMapPrev = new Map(skuSalesQueryPrev.map(r => [r.item_name?.toLowerCase(), parseFloat(r.sku_sales || 0)]));

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
            const osaBrand = osaMap.get(brand.Brand) || { neno: 0, deno: 0 };
            const osa = osaBrand.deno > 0 ? (osaBrand.neno / osaBrand.deno) * 100 : 0;
            const prevOsaDeno = parseFloat(prevBrand.deno_osa_sum || 0);
            const prevOsaNeno = parseFloat(prevBrand.neno_osa_sum || 0);
            const osaPrev = prevOsaDeno > 0 ? (prevOsaNeno / prevOsaDeno) * 100 : 0;
            const osaDelta = calcChange(osa, osaPrev);

            // Calculate SOS (Share of Search) - using rb_kw_olap logic
            const bNameLower = brand.Brand?.toLowerCase();
            const neno = sosNenoMap.get(bNameLower) || 0;
            const sos = sosDeno > 0 ? (neno / sosDeno) * 100 : 0;

            const nenoPrev = sosNenoMapPrev.get(bNameLower) || 0;
            const sosPrev = sosDenoPrev > 0 ? (nenoPrev / sosDenoPrev) * 100 : 0;
            const sosDelta = calcPPChange(sos, sosPrev);

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

            // Market Share: Individual brand's share = brand's sales / total platform sales
            const marketShare = brandSalesMap.get(brandLower) || 0;
            const marketSharePrev = brandSalesMapPrev.get(brandLower) || 0;
            const marketShareDelta = calcChange(marketShare, marketSharePrev);

            // Category Share: Individual brand's share in its specific category
            const lowerBrandCat = brandCategory.toLowerCase();
            const categoryTotalSales = categoryTotalSalesMap.get(lowerBrandCat) || 0;
            const categoryShare = categoryTotalSales > 0 ? (brandSales / categoryTotalSales) * 100 : 0;
            const categoryTotalSalesPrev = categoryTotalSalesMapPrev.get(lowerBrandCat) || 0;
            const categorySharePrev = categoryTotalSalesPrev > 0 ? (brandSalesPrev / categoryTotalSalesPrev) * 100 : 0;
            const categoryShareDelta = calcChange(categoryShare, categorySharePrev);

            // Listing Percent
            const listingPercent = parseFloat(brand.avg_listing_percent || 0);
            const prevListingPercent = parseFloat(prevBrand.avg_listing_percent || 0);
            const listingPercentDelta = calcChange(listingPercent, prevListingPercent);

            return {
                brand_name: brand.Brand,
                brand: brand.Brand,
                OSA: { value: parseFloat(osa.toFixed(1)), delta: parseFloat(osaDelta.toFixed(1)) },
                SOS: { value: parseFloat(sos.toFixed(3)), delta: parseFloat(sosDelta.toFixed(3)) },
                Discount: { value: parseFloat(discount.toFixed(1)), delta: parseFloat(discountDelta.toFixed(1)) },
                PricePerUnit: { value: parseFloat(pricePerUnit.toFixed(1)), delta: parseFloat(pricePerUnitDelta.toFixed(1)) },
                ASP: { value: parseFloat(avgSellingPrice.toFixed(0)), delta: parseFloat(aspDelta.toFixed(1)) },
                RPI: { value: parseFloat(rpi.toFixed(2)), delta: parseFloat(rpiDelta.toFixed(1)) },
                // Legacy key for compat if needed
                Price: { value: parseFloat(avgSellingPrice.toFixed(0)), delta: parseFloat(aspDelta.toFixed(1)) },
                CategoryShare: { value: parseFloat(categoryShare.toFixed(1)), delta: parseFloat(categoryShareDelta.toFixed(1)) },
                MarketShare: { value: parseFloat(marketShare.toFixed(1)), delta: parseFloat(marketShareDelta.toFixed(1)) },
                ListingPercent: { value: parseFloat(listingPercent.toFixed(1)), delta: parseFloat(listingPercentDelta.toFixed(1)) },
                Assortment: { value: parseInt(brand.assortment || 0), delta: 0 },
                Listing: { value: parseFloat(listingPercent.toFixed(1)), delta: parseFloat(listingPercentDelta.toFixed(1)) }
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
            AVG(${src.f.listingPercent}) as avg_listing_percent
                FROM ${src.table}
                WHERE ${currConds}
                GROUP BY Product, Brand
                LIMIT 100
            `),
            queryClickHouse(`
                SELECT ${src.f.product} as Product,
            SUM(${src.f.sales}) as total_sales,
            SUM(${src.f.spend}) as total_spend,
            SUM(${src.f.adSales}) as total_ad_sales,
            SUM(${src.f.impressions}) as total_impressions,
            AVG(${src.f.mrp}) as avg_price,
            SUM(${src.f.neno}) as neno_osa_sum,
            SUM(${src.f.deno}) as deno_osa_sum,
            AVG(${src.f.listingPercent}) as avg_listing_percent
                FROM ${src.table}
                WHERE ${currConds}
                GROUP BY Product
            `),
            queryClickHouse(`
                SELECT ${src.f.product} as Product,
            SUM(${src.f.sales}) as total_sales,
            SUM(${src.f.spend}) as total_spend,
            SUM(${src.f.adSales}) as total_ad_sales,
            SUM(${src.f.impressions}) as total_impressions,
            AVG(${src.f.mrp}) as avg_price,
            SUM(${src.f.neno}) as neno_osa_sum,
            SUM(${src.f.deno}) as deno_osa_sum,
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
            const nenoOsa = parseFloat(sku.neno_osa_sum || 0);
            const denoOsa = parseFloat(sku.deno_osa_sum || 0);
            const osa = denoOsa > 0 ? (nenoOsa / denoOsa) * 100 : 0;
            const prevDenoOsa = parseFloat(prevSku.deno_osa_sum || 0);
            const prevNenoOsa = parseFloat(prevSku.neno_osa_sum || 0);
            const prevOsa = prevDenoOsa > 0 ? (prevNenoOsa / prevDenoOsa) * 100 : 0;
            const osaDelta = calcChange(osa, prevOsa);

            // Calculate SOS (Share of Search)
            const prodLower = sku.Product?.toLowerCase();
            const skuNeno = skuSosNenoMap.get(prodLower) || 0;
            const sos = sosDeno > 0 ? (skuNeno / sosDeno) * 100 : 0;

            const skuNenoPrev = skuSosNenoMapPrev.get(prodLower) || 0;
            const prevSos = sosDenoPrev > 0 ? (skuNenoPrev / sosDenoPrev) * 100 : 0;
            const sosDelta = calcPPChange(sos, prevSos);

            // Calculate Price
            const prevAvgPrice = parseFloat(prevSku.avg_price || 0);
            const priceDelta = calcChange(avgPrice, prevAvgPrice);

            // Market Share: Use the brand's averaged market share directly from helper
            const marketShare = brandSalesMap.get(sku.Brand?.toLowerCase()) || 0;
            const marketSharePrev = brandSalesMapPrev.get(sku.Brand?.toLowerCase()) || 0;
            const marketShareDelta = calcChange(marketShare, marketSharePrev);

            // Category Share: Our brands' share in this SKU's specific category
            const lowerSkuCat = skuCategory.toLowerCase();
            const skuBrandSales = brandAbsoluteSalesMap.get(sku.Brand?.toLowerCase()) || 0;
            const skuCategoryTotalSales = categoryTotalSalesMap.get(lowerSkuCat) || 0;
            const categoryShare = skuCategoryTotalSales > 0 ? (skuBrandSales / skuCategoryTotalSales) * 100 : 0;

            const skuBrandSalesPrev = brandAbsoluteSalesMapPrev.get(sku.Brand?.toLowerCase()) || 0;
            const skuCategoryTotalSalesPrev = categoryTotalSalesMapPrev.get(lowerSkuCat) || 0;
            const categorySharePrev = skuCategoryTotalSalesPrev > 0 ? (skuBrandSalesPrev / skuCategoryTotalSalesPrev) * 100 : 0;
            const categoryShareDelta = calcChange(categoryShare, categorySharePrev);

            // Listing Percent
            const skuListingPercent = parseFloat(sku.avg_listing_percent || 0);
            const prevSkuListingPercent = parseFloat(prevSku.avg_listing_percent || 0);
            const skuListingPercentDelta = calcChange(skuListingPercent, prevSkuListingPercent);

            return {
                sku_name: sku.Product,
                brand_name: sku.Brand,
                brand: sku.Product,
                OSA: { value: parseFloat(osa.toFixed(1)), delta: parseFloat(osaDelta.toFixed(1)) },
                SOS: { value: parseFloat(sos.toFixed(3)), delta: parseFloat(sosDelta.toFixed(3)) },
                Price: { value: parseFloat(avgPrice.toFixed(0)), delta: parseFloat(priceDelta.toFixed(1)) },
                CategoryShare: { value: parseFloat(categoryShare.toFixed(1)), delta: parseFloat(categoryShareDelta.toFixed(1)) },
                MarketShare: { value: parseFloat(marketShare.toFixed(1)), delta: parseFloat(marketShareDelta.toFixed(1)) },
                ListingPercent: { value: parseFloat(skuListingPercent.toFixed(1)), delta: parseFloat(skuListingPercentDelta.toFixed(1)) }
            };
        });

        // Sort by OSA descending and limit to top 10
        skuMetrics.sort((a, b) => (b.OSA?.value || 0) - (a.OSA?.value || 0));
        const topSkus = skuMetrics.slice(0, 10);

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
        const { platform = 'All', location = 'All', category = 'All', brand = 'All', context } = filters;
        console.log('[getCompetitionFilterOptions] Cascading filters:', { platform, location, category, brand, context });

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        const platArr = platform && platform !== 'All' ? platform.split(',').map(p => p.trim()).filter(p => p && p !== 'All') : [];
        const locArr = location && location !== 'All' && location !== 'All India' ? location.split(',').map(l => l.trim()).filter(l => l && l !== 'All' && l !== 'All India') : [];
        const catArr = category && category !== 'All' ? category.split(',').map(c => c.trim()).filter(c => c && c !== 'All') : [];
        const brandArr = brand && brand !== 'All' ? brand.split(',').map(b => b.trim()).filter(b => b && b !== 'All') : [];
        const bndArr = brandArr; // Alias for compatibility with existing code below

        // Build base condition for rca_sku_dim
        const buildBaseConds = () => {
            const conds = [`toString(status) = '1'`];
            if (platArr.length > 0) conds.push(`lower(Platform) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
            if (locArr.length > 0) conds.push(`lower(location) IN(${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(',')})`);
            return conds;
        };

        const src = await getWatchtowerSource();
        // Run all queries in parallel using ClickHouse
        const [locationResults, categoryResults, brandResults, skuResults] = await Promise.all([
            // Fetch distinct locations from dynamic source
            queryClickHouse(`SELECT DISTINCT ${src.f.location} as location FROM ${src.table} WHERE ${src.f.location} IS NOT NULL AND ${src.f.location} != '' ORDER BY location`),

            // Fetch distinct product categories filtered by platform/location
            (() => {
                const conds = [];
                const allowedCategories = ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
                if (platArr && platArr.length > 0) {
                    conds.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
                }
                if (locArr && locArr.length > 0) {
                    conds.push(`lower(${src.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(',')})`);
                }
                const catCol = src.f.category;
                conds.push(`${catCol} IS NOT NULL`, `${catCol} != ''`);
                conds.push(`${catCol} IN (${allowedCategories.map(c => `'${escapeStr(c)}'`).join(',')})`);
                return queryClickHouse(`SELECT DISTINCT ${catCol} as category FROM ${src.table} WHERE ${conds.length > 0 ? conds.join(' AND ') : '1=1'} ORDER BY category`);
            })(),

            // Fetch distinct brands filtered by platform/location + category
            (() => {
                const conds = [];
                if (platArr && platArr.length > 0) {
                    conds.push(`lower(${src.f.platform}) IN (${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(',')})`);
                }
                if (locArr && locArr.length > 0) {
                    conds.push(`lower(${src.f.location}) IN (${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(',')})`);
                }
                conds.push(`${src.f.brand} IS NOT NULL`, `${src.f.brand} != ''`);
                if (context === 'performance') {
                    conds.push(`toString(${src.f.compFlag}) = '0'`);
                } else {
                    conds.push(`toString(${src.f.compFlag}) IN ('0', '1')`);
                }
                if (catArr && catArr.length > 0) {
                    const catCol = src.f.category;
                    conds.push(`lower(${catCol}) IN (${catArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
                }
                return queryClickHouse(`SELECT DISTINCT ${src.f.brand} as brand FROM ${src.table} WHERE ${conds.length > 0 ? conds.join(' AND ') : '1=1'} ORDER BY brand`);
            })(),

            // Fetch distinct SKUs from dynamic source filtered by platform/location + category + brand
            (() => {
                const conds = [];
                if (platform && platform !== 'All') {
                    const platArr = platform.split(',').map(p => p.trim()).filter(p => p && p !== 'All');
                    if (platArr.length > 0) conds.push(`${src.f.platform} IN(${platArr.map(p => `'${escapeStr(p)}'`).join(',')})`);
                }
                if (location && location !== 'All' && location !== 'All India') {
                    const locArr = location.split(',').map(l => l.trim()).filter(l => l && l !== 'All' && l !== 'All India');
                    if (locArr.length > 0) conds.push(`${src.f.location} IN(${locArr.map(l => `'${escapeStr(l)}'`).join(',')})`);
                }
                if (catArr.length > 0) {
                    const catCol = src.f.category;
                    conds.push(`${catCol} IN(${catArr.map(c => `'${escapeStr(c)}'`).join(',')})`);
                }
                if (bndArr.length > 0) {
                    conds.push(`${src.f.brand} IN(${bndArr.map(b => `'${escapeStr(b)}'`).join(',')})`);
                }
                if (context === 'performance') {
                    conds.push(`toString(${src.f.compFlag}) = '0'`);
                } else {
                    conds.push(`toString(${src.f.compFlag}) IN ('0', '1')`);
                }
                conds.push(`${src.f.product} IS NOT NULL`, `${src.f.product} != ''`, `${src.f.skuCode} IS NOT NULL`, `${src.f.skuCode} != ''`);
                return queryClickHouse(`SELECT DISTINCT ${src.f.product} as skuName, toString(${src.f.skuCode}) as skuCode FROM ${src.table} WHERE ${conds.length > 0 ? conds.join(' AND ') : '1=1'} ORDER BY skuName LIMIT 500`);
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
                SELECT MAX(toDate(extraction_timestamp)) as latestDate
                FROM tb_content_score_data
                ${contentWhere}
        `);

            const latestContentDate = contentResult?.[0]?.latestDate;
            if (!latestContentDate) return { available: false };

            const latestC = dayjs(latestContentDate);
            return {
                available: true,
                monthLabel: latestC.format('MMMM YYYY'),
                startDate: latestC.startOf('month').format('YYYY-MM-DD'),
                endDate: latestC.endOf('month').format('YYYY-MM-DD'),
                latestDate: latestC.format('YYYY-MM-DD'),
                defaultStartDate: latestC.startOf('month').format('YYYY-MM-DD'),
                defaultEndDate: latestC.format('YYYY-MM-DD')
            };
        }

        const src = await getWatchtowerSource();
        // Build WHERE conditions for dynamic source
        const conditions = [`toString(${src.f.compFlag}) = '0'`];

        if (platform && platform !== 'All') {
            conditions.push(`lower(${src.f.platform}) = '${escapeStr(platform.toLowerCase())}'`);
        }

        if (brand && brand !== 'All') {
            conditions.push(`${src.f.brand} LIKE '%${escapeStr(brand)}%'`);
        }

        if (location && location !== 'All') {
            conditions.push(`lower(${src.f.location}) = '${escapeStr(location.toLowerCase())}'`);
        }

        if (category && category !== 'All') {
            const catCol = src.f.category;
            conditions.push(`lower(${catCol}) = '${escapeStr(category.toLowerCase())}'`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')} ` : '';

        // Query dynamic source for the latest date
        const result = await queryClickHouse(`
            SELECT MAX(toDate(${src.f.date})) as latestDate
            FROM ${src.table}
            ${whereClause}
        `);

        const latestDate = result?.[0]?.latestDate;

        if (!latestDate) {
            return { available: false };
        }

        const latest = dayjs(latestDate);

        return {
            available: true,
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
        let { brands = 'All', skus = 'All', location = 'All', category = 'All', period = '1M', platform = 'All' } = filters;

        // Handle "All India" -> "All" conversion
        if (location === 'All India') location = 'All';

        console.log('[getCompetitionBrandTrends] Filters:', { brands, skus, location, category, period });

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

        const endDate = await getCachedMaxDate();
        let startDate;
        switch (period) {
            case '1W': startDate = endDate.subtract(7, 'days'); break;
            case '1M': startDate = endDate.subtract(1, 'month'); break;
            case '3M': startDate = endDate.subtract(3, 'month'); break;
            case '6M': startDate = endDate.subtract(6, 'month'); break;
            case '1Y': startDate = endDate.subtract(1, 'year'); break;
            default: startDate = endDate.subtract(1, 'month'); // Default 1M
        }

        console.log(`[getCompetitionBrandTrends] Valid brands(comp_flag = 0): ${validBrandNames.length} `);

        const src = await getWatchtowerSource();
        // First, get total impressions from dynamic source and Market Share from rb_brand_ms
        const baseConds = [`toDate(${src.f.date}) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        // baseConds.push(`toString(${src.f.compFlag}) = '1'`);  // REMOVED: Allow both base and competitor brands for SOS denominator and direct querying

        const locArr = normalizeFilterArray(location);
        if (locArr && locArr.length > 0) {
            baseConds.push(`${src.f.location} IN(${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }

        // Market Share conditions for rb_brand_ms table (platform-level totals)
        const msBaseConds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        msBaseConds.push(`sales IS NOT NULL`);
        if (locArr && locArr.length > 0) {
            msBaseConds.push(`location IN(${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }

        // Category Share conditions for rb_brand_ms table (category-level totals)
        const catBaseConds = [`toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        catBaseConds.push(`sales IS NOT NULL`);
        if (locArr && locArr.length > 0) {
            catBaseConds.push(`location IN(${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        const catArr = (normalizeFilterArray(category) || []).map(c => c.toLowerCase());
        if (catArr.length > 0) {
            const catEscaped = catArr.map(c => `'${escapeStr(c)}'`).join(', ');
            catBaseConds.push(`lower(category) IN(${catEscaped})`);
        }

        // Build valid brands filter for market share numerator
        const validBrandsFilter = validBrandNames.length > 0
            ? `group_brand IN(${validBrandNames.map(b => `'${escapeStr(b)}'`).join(', ')})`
            : '1=0';

        // Build conditions for Keyword Share of Search (Denominator)
        const platArr = normalizeFilterArray(platform);
        const kwBaseConds = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
        if (platArr && platArr.length > 0) {
            kwBaseConds.push(`lower(platform_name) IN(${platArr.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
        }
        if (locArr && locArr.length > 0) {
            kwBaseConds.push(`lower(location_name) IN(${locArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
        }
        const catArrNorm = normalizeFilterArray(category);
        if (catArrNorm && catArrNorm.length > 0) {
            kwBaseConds.push(`lower(keyword_category) IN(${catArrNorm.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
        }
        // Removed keyword_search_rank filter (not in actual schema)

        // Parallel queries: total impressions, total sales (MS denominator), our brands sales (MS numerator), category totals
        const [totalsData, msTotalsData, msOurBrandsData, catTotalsData, kwTotalsData] = await Promise.all([
            // Query 1: Total impressions per day from dynamic source (for SOS calculation)
            queryClickHouse(`
        SELECT
        toDate(${src.f.date}) as date_key,
            SUM(${src.f.impressions}) as total_impressions
                FROM ${src.table}
                WHERE ${baseConds.join(' AND ')}
                GROUP BY date_key
                ORDER BY date_key ASC
            `),
            // Query 2: Total platform sales per day from rb_ms_olap (Market Share denominator)
            queryClickHouse(`
        SELECT
        toDate(created_on) as date_key,
            SUM(toFloat64OrZero(toString(sales))) as total_sales
                FROM rb_ms_olap
                WHERE ${msBaseConds.join(' AND ')}
                GROUP BY date_key
                ORDER BY date_key ASC
            `),
            // Query 3: Our brands (comp_flag=0) sales per day from rb_ms_olap (Market Share numerator)
            queryClickHouse(`
        SELECT
        toDate(created_on) as date_key,
            SUM(toFloat64OrZero(toString(sales))) as our_sales
                FROM rb_ms_olap
                WHERE ${msBaseConds.join(' AND ')} AND ${validBrandsFilter}
                GROUP BY date_key
                ORDER BY date_key ASC
            `),
            // Query 4: Total category sales per day from rb_ms_olap (Category Share denominator)
            queryClickHouse(`
        SELECT
        toDate(created_on) as date_key,
            SUM(toFloat64OrZero(toString(sales))) as total_cat_sales
                FROM rb_ms_olap
                WHERE ${catBaseConds.join(' AND ')}
                GROUP BY date_key
                ORDER BY date_key ASC
            `),
            // Query 5: Total keyword searches per day for SOS Denominator
            queryClickHouse(`
        SELECT
        toDate(DATE) as date_key,
            COUNT(*) as total_kw
                FROM rb_kw_olap
                WHERE ${kwBaseConds.join(' AND ')}
                GROUP BY date_key
                ORDER BY date_key ASC
            `)
        ]);

        // Build lookup maps for totals by date
        const totalsMap = new Map(totalsData.map(r => [
            String(r.date_key),
            { total_impressions: parseFloat(r.total_impressions || 0) }
        ]));

        const msTotalsMap = new Map(msTotalsData.map(r => [
            String(r.date_key),
            { total_sales: parseFloat(r.total_sales || 0) }
        ]));


        // Note: msOurBrandsData is not mapped here as we query per-brand sales inside the loop

        const catTotalsMap = new Map(catTotalsData.map(r => [
            String(r.date_key),
            { total_category_sales: parseFloat(r.total_cat_sales || 0) }
        ]));

        const kwTotalsMap = new Map(kwTotalsData.map(r => [
            String(r.date_key),
            { total_kw: parseFloat(r.total_kw || 0) }
        ]));

        console.log(`[getCompetitionBrandTrends] Got totals: ${totalsData.length} days impressions, ${msTotalsData.length} days platform sales, ${catTotalsData.length} days category sales`);

        const brandTrends = {};

        for (const targetName of targetList) {
            const src = await getWatchtowerSource();
            // Build conditions for dynamic source (OSA, SOS, Price)
            const conds = [`toDate(${src.f.date}) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];
            const locArr = normalizeFilterArray(location);
            if (locArr && locArr.length > 0) {
                conds.push(`${src.f.location} IN(${locArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
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
                targetKwConds = [...kwBaseConds, `(lower(brand_name_th) = '${targetEscaped}' OR lower(keyword_search_product) LIKE '%${targetEscaped}%')`];
            }

            // Parallel queries: main metrics from dynamic source and sales from rb_brand_ms
            const [rawData, targetSalesData, targetKwData] = await Promise.all([
                // Query main metrics (OSA, SOS numerator, Price)
                queryClickHouse(`
        SELECT
        toDate(${src.f.date}) as date_key,
            SUM(${src.f.sales}) as Offtakes,
            SUM(${src.f.spend}) as Spend,
            SUM(${src.f.adSales}) as Ad_sales,
            SUM(${src.f.neno}) as neno_osa_sum,
            SUM(${src.f.deno}) as deno_osa_sum,
            SUM(${src.f.impressions}) as Impressions,
            AVG(${src.f.mrp}) as avg_price
                    FROM ${src.table}
                    WHERE ${conds.join(' AND ')}
                    GROUP BY date_key
                    ORDER BY date_key ASC
            `),
                // Query this specific target's sales per day from rb_ms_olap (for Market Share numerator)
                queryClickHouse(`
        SELECT
        toDate(created_on) as date_key,
            SUM(toFloat64OrZero(toString(sales))) as target_sales
                    FROM rb_ms_olap
                    WHERE ${targetMsConds.join(' AND ')}
                    GROUP BY date_key
                    ORDER BY date_key ASC
            `),
                // Query this specific target's keyword count per day from rb_kw_olap (for SOS numerator)
                queryClickHouse(`
        SELECT
        toDate(DATE) as date_key,
            countIf(toInt32(overall) = 1) as target_kw
                    FROM rb_kw_olap
                    WHERE ${targetKwConds.join(' AND ')}
                    GROUP BY date_key
                    ORDER BY date_key ASC
            `)
            ]);

            // Build lookup map for this target's sales per day
            const targetSalesMap = new Map(targetSalesData.map(r => [
                String(r.date_key),
                parseFloat(r.target_sales || 0)
            ]));

            const targetKwMap = new Map(targetKwData.map(r => [
                String(r.date_key),
                parseFloat(r.target_kw || 0)
            ]));

            if (targetName === 'Amul' || targetName === 'Ferrero') {
                console.log(`[DEBUG SOS ${targetName}] targetKwMap keys:`, Array.from(targetKwMap.keys()).slice(0, 5));
                console.log(`[DEBUG SOS ${targetName}] kwTotalsMap keys:`, Array.from(kwTotalsMap.keys()).slice(0, 5));
                if (rawData.length > 0) {
                    console.log(`[DEBUG SOS ${targetName}] rawData key type:`, String(rawData[0].date_key));
                }
            }

            console.log(`[getCompetitionBrandTrends] Target "${targetName}": ${rawData.length} data points, ${targetSalesData.length} market share points`);

            // Process the raw data to get trend points
            brandTrends[targetName] = rawData.map(row => {
                const nenoOsa = parseFloat(row.neno_osa_sum || 0);
                const denoOsa = parseFloat(row.deno_osa_sum || 0);
                const avgPrice = parseFloat(row.avg_price || 0);
                const impressions = parseFloat(row.Impressions || 0);

                // Calculate OSA
                const osa = denoOsa > 0 ? ((nenoOsa / denoOsa) * 100) : 0;

                // Get totals for this date (use String() for consistent key format)
                const dateKey = String(row.date_key);
                const totals = totalsMap.get(dateKey) || { total_impressions: 0 };
                const msTotals = msTotalsMap.get(dateKey) || { total_sales: 0 };
                const catTotals = catTotalsMap.get(dateKey) || { total_category_sales: 0 };
                const targetSales = targetSalesMap.get(dateKey) || 0;
                const kwTotals = kwTotalsMap.get(dateKey) || { total_kw: 0 };
                const targetKw = targetKwMap.get(dateKey) || 0;

                // Calculate SOS (Share of Search) = target_kw / total_kw
                const sos = kwTotals.total_kw > 0
                    ? (targetKw / kwTotals.total_kw) * 100
                    : 0;

                if (targetName === 'Amul' && row.date_key === '2025-12-07') {
                    console.log(`[DEBUG SOS Amul calc] date: ${dateKey}, targetKw: ${targetKw}, totalKw: ${kwTotals.total_kw}, sos: ${sos}`);
                }

                // Calculate Market Share = this specific's sales / total platform sales
                // (Note: for SKUs, this is an approximation as it uses the SKU sales / platform sales)
                const marketShare = msTotals.total_sales > 0
                    ? (targetSales / msTotals.total_sales) * 100
                    : 0;

                // Calculate Category Share = this specific's sales / total category sales
                // (Also an approximation without explicitly scoping to the SKU's category vs just total category sales from rb_ms_olap where Category is not null)
                const categoryShare = catTotals.total_category_sales > 0
                    ? (targetSales / catTotals.total_category_sales) * 100
                    : 0;

                // Return KPIs consistent with frontend and getKpiTrends
                return {
                    date: dayjs(row.date_key).format("DD MMM'YY"),
                    // Capitalized for TrendsCompetitionDrawer compatibility
                    OSA: parseFloat(osa.toFixed(1)),
                    osa: parseFloat(osa.toFixed(1)),
                    SOS: parseFloat(sos.toFixed(1)),
                    sos: parseFloat(sos.toFixed(1)),
                    Price: parseFloat(avgPrice.toFixed(0)),
                    price: parseFloat(avgPrice.toFixed(0)),
                    CategoryShare: parseFloat(categoryShare.toFixed(1)),
                    categoryShare: parseFloat(categoryShare.toFixed(1)),
                    MarketShare: parseFloat(marketShare.toFixed(1)),
                    marketShare: parseFloat(marketShare.toFixed(1))
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
            }
        };
    } catch (error) {
        console.error('[getCompetitionBrandTrends] Error:', error);
        return { brands: {}, metadata: { error: error.message } };
    }
};

/**
 * Get Dark Store Count from rb_location_darkstore table
 * Returns count of distinct merchant_name grouped by platform based on filters
 * @param {Object} filters - { platform, location, startDate, endDate }
 * @returns {Object} - { totalCount, byPlatform: { platform: count } }
 */
/**
 * Get Dark Store Count from rb_location_darkstore table
 * Returns count of distinct merchant_name grouped by platform based on filters
 * @param {Object} filters - { platform, location, startDate, endDate }
 * @returns {Object} - { totalCount, byPlatform: { platform: count } }
 */
const getDarkStoreCount = async (filters = {}) => {
    try {
        console.log('[getDarkStoreCount] Fetching dark store count with filters:', filters);

        const { platform, location, startDate, endDate } = filters;

        // Helper to escape strings for ClickHouse
        const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

        // Build conditions
        const conds = [];

        // Base conditions requested by user
        conds.push(`pf_id IN(4, 6, 7)`);
        conds.push(`status IN('1', '2')`);

        // Platform filter
        if (platform && platform !== 'All') {
            const platformArr = Array.isArray(platform) ? platform : [platform];
            if (platformArr.length > 0) {
                conds.push(`platform IN(${platformArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            }
        }

        // Location filter
        if (location && location !== 'All') {
            const locationArr = Array.isArray(location) ? location : [location];
            if (locationArr.length > 0) {
                conds.push(`location IN(${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
            }
        }

        const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')} ` : '';

        // Query for dark store count grouped by platform (refined as per user request)
        const query = `
        SELECT
        pf_id,
            platform,
            uniq(concat(toString(pincode), merchant_name)) AS store_count
            FROM rb_location_darkstore
            ${whereClause}
            GROUP BY
        pf_id,
            platform
            LIMIT 100
            `;

        console.log('[getDarkStoreCount] Query:', query);

        const results = await queryClickHouse(query);

        // Build response
        const byPlatform = {};
        let totalCount = 0;

        results.forEach(row => {
            const count = parseInt(row.store_count) || 0;
            byPlatform[row.platform] = count;
            totalCount += count;
        });

        console.log(`[getDarkStoreCount] Total: ${totalCount}, By Platform: `, byPlatform);

        return {
            totalCount,
            byPlatform
        };
    } catch (error) {
        console.error('[getDarkStoreCount] Error:', error);
        return { totalCount: 0, byPlatform: {} };
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
                return { day: label, current: parseFloat(c.toFixed(1)), compare: parseFloat(p.toFixed(1)) };
            });
        };

        const result = {
            counts: { darkstoreCount, skuCount },
            kpis: {
                osa: { value: hasOlapData ? `${currentOsa.toFixed(1)}% ` : "N/A", delta: hasOlapData ? `${osaDelta >= 0 ? '+' : ''}${osaDelta.toFixed(1)}% ` : "0" },
                fillRate: { value: "Coming Soon", delta: "0" },
                salesMtd: { value: hasOlapData ? `₹${(currentSales / 10000000).toFixed(1)} Cr` : "N/A", delta: hasOlapData ? `${salesDelta >= 0 ? '+' : ''}${salesDelta.toFixed(1)}% ` : "0" },
                lostSales: { value: hasOlapData ? `₹${(lostSales / 10000000).toFixed(1)} Cr` : "N/A", delta: "" },
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
                cityMap[key].osa = osa.toFixed(1) + '%';
                cityMap[key].sales = `₹${(sales / 10000000).toFixed(1)} Cr`;
                cityMap[key].lostSales = `₹${(lostSales / 10000000).toFixed(1)} Cr`;
                cityMap[key].heroSkus = row.hero_skus.toString();
            } else {
                // If it's a city in OLAP but not in Darkstore list (rare), add it too
                cityMap[key] = {
                    city: row.city,
                    osa: osa.toFixed(1) + '%',
                    fillRate: 'Coming Soon',
                    sales: `₹${(sales / 10000000).toFixed(1)} Cr`,
                    lostSales: `₹${(lostSales / 10000000).toFixed(1)} Cr`,
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
        const { platform = 'All', category = 'All', brand = 'All', sku = 'All', month } = filters;
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

        // Previous period for delta calculation (same duration, shifted back)
        const diff = endDate.diff(startDate, 'day') + 1;
        const prevEndDate = startDate.subtract(1, 'day');
        const prevStartDate = prevEndDate.subtract(diff - 1, 'day');
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
                conds.push(`${src.f.platform} IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            }
            const catArr = normalizeFilterArray(category);
            if (catArr && catArr.length > 0) {
                const catCol = src.f.category;
                conds.push(`${catCol} IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
            }
            if (brand && brand !== 'All' && brand !== 'All Brands') {
                conds.push(`${src.f.brand} LIKE '%${escapeStr(brand)}%'`);
            }
            if (sku && sku !== 'All' && sku !== 'All SKUs') {
                conds.push(`${src.f.skuCode} = '${escapeStr(sku)}'`);
            }
            return conds.join(' AND ');
        };

        // Build conditions for rb_kw_olap
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

        // Build conditions for rb_brand_ms
        const buildMsConds = (sDate, eDate) => {
            const conds = [`toDate(created_on) BETWEEN '${sDate}' AND '${eDate}'`];
            const platArr = normalizeFilterArray(platform);
            if (platArr && platArr.length > 0) {
                conds.push(`platform IN(${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
            }
            if (category && category !== 'All') {
                conds.push(`category = '${escapeStr(category)}'`);
            }
            return conds.join(' AND ');
        };

        const currOlapConds = buildOlapConds(startStr, endStr);
        const prevOlapConds = buildOlapConds(prevStartStr, prevEndStr);
        const currKwConds = buildKwConds(startStr, endStr);
        const prevKwConds = buildKwConds(prevStartStr, prevEndStr);
        const currMsConds = buildMsConds(startStr, endStr);

        // (src already defined at top)
        // The big OLAP query - get all metrics in one shot
        const olapQuery = (conds) => `
        SELECT
        SUM(${src.f.sales}) as sales,
            SUM(${src.f.quantitySold}) as qty,
            SUM(${src.f.spend}) as spend,
            SUM(${src.f.adSales}) as ad_sales,
            SUM(${src.f.clicks}) as clicks,
            SUM(${src.f.impressions}) as impressions,
            SUM(${src.f.orders}) as orders,
            SUM(${src.f.neno}) as neno,
            SUM(${src.f.deno}) as deno,
            AVG(CASE WHEN ${src.f.mrp} > 0 
                    THEN(${src.f.mrp} - ${src.f.sellingPrice}) / ${src.f.mrp} 
                    ELSE 0 END) * 100 as avg_discount,
            countIf(${src.f.deno} > 0) as listed_count,
            count() as total_count
            FROM ${src.table}
            WHERE ${conds}
        `;

        // SOS query from rb_kw_olap - using keyword-level join logic
        const kwQuery = (conds) => `
            WITH 
            n AS (
                SELECT 
                    countIf(toInt32(overall) = 1) as neno,
                    countIf(toInt32(spons) = 1) as ad_rb_neno,
                    countIf(toInt32(organic) = 1) as organic_rb_neno
                FROM rb_kw_olap 
                WHERE ${conds} AND toString(flag) = '1'
            ),
            d AS (
                SELECT 
                    count() as deno,
                    countIf(toInt32(spons) = 1) as ad_deno,
                    countIf(toInt32(organic) = 1) as organic_deno
                FROM rb_kw_olap 
                WHERE ${conds}
            )
            SELECT 
                n.neno as rb_kw_olaps,
                d.deno as total_kws,
                n.organic_rb_neno as organic_rb_kw_olaps,
                n.ad_rb_neno as ad_rb_kw_olaps,
                d.organic_deno as organic_kws,
                d.ad_deno as ad_kws
            FROM n, d
        `;

        const brandArrForMs = normalizeFilterArray(brand);
        const brandCaseWhen = brandArrForMs && brandArrForMs.length > 0
            ? `group_brand IN(${brandArrForMs.map(b => `'${escapeStr(b)}'`).join(', ')})`
            : `group_brand = '${escapeStr(brand)}'`;

        // Execute all queries in parallel
        const [currOlap, prevOlap, currKw, prevKw, currMs] = await Promise.all([
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
        `)
        ]);

        const curr = currOlap[0] || {};
        const prev = prevOlap[0] || {};
        const kwCurr = currKw[0] || {};
        const kwPrev = prevKw[0] || {};
        const ms = currMs[0] || {};

        // Parse current values
        const cSales = parseFloat(curr.sales || 0);
        const cQty = parseFloat(curr.qty || 0);
        const cImp = parseFloat(curr.impressions || 0);
        const cClicks = parseFloat(curr.clicks || 0);
        const cOrders = parseFloat(curr.orders || 0);
        const cAdSales = parseFloat(curr.ad_sales || 0);
        const cSpend = parseFloat(curr.spend || 0);
        const cNeno = parseFloat(curr.neno || 0);
        const cDeno = parseFloat(curr.deno || 0);
        const cDiscount = parseFloat(curr.avg_discount || 0);
        const cListed = parseFloat(curr.listed_count || 0);
        const cTotal = parseFloat(curr.total_count || 1);

        // Parse previous values
        const pSales = parseFloat(prev.sales || 0);
        const pQty = parseFloat(prev.qty || 0);
        const pImp = parseFloat(prev.impressions || 0);
        const pClicks = parseFloat(prev.clicks || 0);
        const pOrders = parseFloat(prev.orders || 0);
        const pAdSales = parseFloat(prev.ad_sales || 0);
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
        const cCvr = cImp > 0 ? (cOrders / cImp) * 100 : 0;
        const pCvr = pImp > 0 ? (pOrders / pImp) * 100 : 0;
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
            if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(1)} Cr`;
            if (val >= 100000) return `₹ ${(val / 100000).toFixed(1)} lac`;
            if (val >= 1000) return `₹ ${(val / 1000).toFixed(1)} K`;
            return `₹ ${val.toFixed(0)} `;
        };

        const formatCount = (val) => {
            if (val >= 10000000) return `${(val / 10000000).toFixed(1)} Cr`;
            if (val >= 100000) return `${(val / 100000).toFixed(1)} lac`;
            if (val >= 1000) return `${(val / 1000).toFixed(1)} K`;
            return `${val.toFixed(0)} `;
        };

        const pctDelta = (curr, prev) => {
            if (prev === 0) return { val: curr > 0 ? '100.0%' : '0.0%', isPos: curr > 0 };
            const d = ((curr - prev) / Math.abs(prev)) * 100;
            return { val: `${Math.abs(d).toFixed(1)}% `, isPos: d >= 0 };
        };

        const absDelta = (curr, prev) => {
            const d = curr - prev;
            return { val: `${Math.abs(d).toFixed(1)}% `, isPos: d >= 0 };
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
        const adImpDelta = pctDelta(cAdKw, parseFloat(kwPrev.ad_kws || 0));
        const orgImpDelta = pctDelta(cOrgKw, parseFloat(kwPrev.organic_kws || 0));
        const orgRbDelta = pctDelta(cOrgRbKw, pOrgRbKw);
        const adRbDelta = pctDelta(cAdRbKw, pAdRbKw);

        // Construct full RCA tree matching frontend getDynamicRcaTreeData structure
        const tree = {
            id: "root",
            label: "Offtake",
            value: formatLac(cSales),
            change: salesDelta.val,
            isPositive: salesDelta.isPos,
            category: "offtake",
            importance: "outcome",
            insight: salesDelta.isPos ? "Volume Growth" : "Critical Decline",
            meta: [{ label: "Est. Category Share", value: `${marketShare.toFixed(1)}% `, change: sosDelta.val, isPositive: sosDelta.isPos }],
            children: [
                {
                    id: "asp",
                    label: "ASP",
                    value: `₹ ${cAsp.toFixed(1)} `,
                    change: aspDelta.val,
                    isPositive: aspDelta.isPos,
                    category: "price",
                    importance: "primary",
                    meta: [{ label: "Baseline ASP", value: `₹ ${pAsp.toFixed(0)} ` }]
                },
                {
                    id: "indexed-impressions",
                    label: "Indexed Impressions",
                    value: formatCount(cImp),
                    change: impDelta.val,
                    isPositive: impDelta.isPos,
                    category: "impressions",
                    importance: "primary",
                    insight: impDelta.isPos ? "High Visibility" : "Visibility Loss",
                    meta: [{ label: "Overall SOS", value: `${cSos.toFixed(1)}% `, change: sosDelta.val, isPositive: sosDelta.isPos }],
                    children: [
                        {
                            id: "availability",
                            label: "Wt. OSA %",
                            value: `${cOsa.toFixed(1)}% `,
                            change: osaDelta.val,
                            isPositive: osaDelta.isPos,
                            category: "availability",
                            children: [
                                {
                                    id: "listing",
                                    label: "DS Listing %",
                                    value: `${cListing.toFixed(1)}% `,
                                    change: listingDelta.val,
                                    isPositive: listingDelta.isPos,
                                    category: "availability"
                                }
                            ]
                        },
                        {
                            id: "organic-impressions",
                            label: "Organic Impressions",
                            value: formatCount(cOrgKw),
                            change: orgImpDelta.val,
                            isPositive: orgImpDelta.isPos,
                            category: "organic",
                            insight: orgImpDelta.isPos ? "Organic Pull" : "Low Ranking",
                            meta: [{ label: "Organic SOS", value: cTotalKw > 0 ? `${((cOrgRbKw / cTotalKw) * 100).toFixed(1)}% ` : "0.0%", change: orgRbDelta.val, isPositive: orgRbDelta.isPos }],
                            children: [
                                { id: "org-generic", label: "Generic Keywords", value: formatCount(cOrgKw - cOrgRbKw), change: orgImpDelta.val, isPositive: orgImpDelta.isPos, category: "organic" },
                                { id: "org-branded", label: "Branded Keywords", value: formatCount(cOrgRbKw), change: orgRbDelta.val, isPositive: orgRbDelta.isPos, category: "organic" }
                            ]
                        }
                    ]
                },
                {
                    id: "indexed-cvr",
                    label: "Indexed CVR",
                    value: `${cCvr.toFixed(1)}% `,
                    change: cvrDelta.val,
                    isPositive: cvrDelta.isPos,
                    category: "conversion",
                    importance: "outcome",
                    insight: cvrDelta.isPos ? "Conv. Efficacy" : "Conv. Drop",
                    children: [
                        {
                            id: "ad-impressions",
                            label: "Ad Impressions",
                            value: formatCount(cAdKw),
                            change: adImpDelta.val,
                            isPositive: adImpDelta.isPos,
                            category: "ad",
                            meta: [{ label: "Ad SOS", value: cTotalKw > 0 ? `${((cAdRbKw / cTotalKw) * 100).toFixed(1)}% ` : "0.0%", change: adRbDelta.val, isPositive: adRbDelta.isPos }],
                            children: [
                                { id: "ad-branded", label: "Branded Keywords", value: formatCount(cAdRbKw), change: adRbDelta.val, isPositive: adRbDelta.isPos, category: "ad" },
                                { id: "ad-comp", label: "Comp Keywords", value: formatCount(cAdKw - cAdRbKw), change: adImpDelta.val, isPositive: adImpDelta.isPos, category: "ad" }
                            ]
                        },
                        { id: "discounting", label: "Wt. Disc %", value: `${cDiscount.toFixed(1)}% `, change: discDelta.val, isPositive: discDelta.isPos, category: "discounting" },
                        { id: "rating-count", label: "Rating Count", value: formatCount(cQty), change: qtyDelta.val, isPositive: qtyDelta.isPos, category: "rating" }
                    ]
                }
            ]
        };

        // Summary cards
        const cards = [
            { title: "Estimated Offtake", value: formatLac(cSales), change: salesDelta.val, isPositive: salesDelta.isPos },
            { title: "Estimated Category Share", value: `${marketShare.toFixed(1)}% `, change: sosDelta.val, isPositive: sosDelta.isPos },
            { title: "Avg Selling Price", value: `₹ ${cAsp.toFixed(0)} `, change: aspDelta.val, isPositive: aspDelta.isPos }
        ];

        console.log(`[getRcaData] Tree built - Offtake: ${formatLac(cSales)}, ASP: ₹${cAsp.toFixed(0)}, OSA: ${cOsa.toFixed(1)}% `);
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

    const { months = 1, startDate: qStartDate, endDate: qEndDate, skuOverviewPlatform, channel } = filters;

    // Extract filter values
    const rawBrand = filters['brand[]'] || filters.brand;
    const rawLocation = filters['location[]'] || filters.location;
    const rawCategory = filters['category[]'] || filters.category;

    // Normalize multi-value filters
    const brandArr = normalizeFilterArray(rawBrand);
    const locationArr = normalizeFilterArray(rawLocation);
    const categoryArr = normalizeFilterArray(rawCategory);
    const skuPlatform = skuOverviewPlatform || filters.platform || 'All';

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
    const src = await getWatchtowerSource();

    // Build SKU conditions for rb_pdp_olap
    const buildSkuConds = (sDate, eDate) => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];

        const brandCol = src.isAgg ? 'brand' : 'Brand';
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `${brandCol} LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
        }

        const platformCol = src.isAgg ? 'platform' : 'Platform';
        const platformCond = buildPlatformChannelCond(skuPlatform, channel, platformCol);
        if (platformCond) conds.push(platformCond);

        const locCol = src.isAgg ? 'location' : 'Location';
        if (locationArr && locationArr.length > 0) {
            conds.push(`${locCol} IN (${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }

        const catCol = src.isAgg ? 'category' : PRODUCT_CATEGORY_SQL;
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`${catCol} IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
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
            conds.push(`location IN(${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    // Build SOS conditions for rb_kw_olap (SKU level uses keyword_search_product)
    const buildSosSkuConds = (sDate, eDate) => {
        const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const pCond = buildPlatformChannelCond(skuPlatform, channel, 'platform_name');
        if (pCond) conds.push(pCond);
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `brand_name_th LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
        }
        if (locationArr && locationArr.length > 0) {
            conds.push(`location_name IN(${locationArr.map(l => `'${escapeStr(l)}'`).join(', ')})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`keyword_category IN(${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        // SKU filter on keyword_search_product
        const skuArr = normalizeFilterArray(filters.skuName);
        if (skuArr && skuArr.length > 0) {
            const skuConds = skuArr.map(s => `lower(keyword_search_product) LIKE '%${escapeStr(s.toLowerCase())}%'`).join(' OR ');
            conds.push(`(${skuConds})`);
        }
        return conds.join(' AND ');
    };

    const currSosSkuConds = buildSosSkuConds(startDate, endDate);
    const prevSosSkuConds = buildSosSkuConds(prevStartDate, prevEndDate);

    // Query SKU metrics for both periods
    const [
        currSkuMetrics, prevSkuMetrics, currMsResult, prevMsResult, currSkuCatSize, prevSkuCatSize,
        currSosNumSku, currSosDenomSku, prevSosNumSku, prevSosDenomSku,
        currAdSovNumSku, currAdSovDenomSku, prevAdSovNumSku, prevAdSovDenomSku,
        currOrgSovNumSku, currOrgSovDenomSku, prevOrgSovNumSku, prevOrgSovDenomSku
    ] = await Promise.all([
        queryClickHouse(`
            SELECT ${src.isAgg ? 'brand' : 'Product'} as Product,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales
            FROM ${src.table}
            WHERE ${currSkuConds} AND ${src.isAgg ? 'brand' : 'Product'} IS NOT NULL AND ${src.isAgg ? 'brand' : 'Product'} != ''
            GROUP BY Product
            ORDER BY total_sales DESC
            LIMIT 50
            `),
        queryClickHouse(`
            SELECT ${src.isAgg ? 'brand' : 'Product'} as Product,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.clicks} ELSE 0 END) as total_clicks,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.impressions} ELSE 0 END) as total_impressions,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.orders} ELSE 0 END) as total_orders,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.neno} ELSE 0 END) as total_neno,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.deno} ELSE 0 END) as total_deno,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.mrpVal} ELSE 0 END) as my_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.actualSales} ELSE 0 END) as my_actual_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.mrpVal} ELSE 0 END) as comp_mrp_val,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 1 THEN ${src.f.actualSales} ELSE 0 END) as comp_actual_sales
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
        // SOS by SKU (keyword_search_product) - countIf(overall=1) with flag=0 for our brands
        queryClickHouse(`SELECT keyword_search_product, countIf(toInt32(overall) = 1) as count FROM rb_kw_olap WHERE ${currSosSkuConds} AND toString(flag) = '1' GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, count() as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, countIf(toInt32(overall) = 1) as count FROM rb_kw_olap WHERE ${prevSosSkuConds} AND toString(flag) = '1' GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, count() as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`),
        // Spons SOS by SKU - countIf(spons=1) with flag=0
        queryClickHouse(`SELECT keyword_search_product, countIf(toInt32(spons) = 1) as count FROM rb_kw_olap WHERE ${currSosSkuConds} AND toString(flag) = '1' GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, count() as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, countIf(toInt32(spons) = 1) as count FROM rb_kw_olap WHERE ${prevSosSkuConds} AND toString(flag) = '1' GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, count() as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`),
        // Organic SOS by SKU - countIf(organic=1) with flag=0
        queryClickHouse(`SELECT keyword_search_product, countIf(toInt32(organic) = 1) as count FROM rb_kw_olap WHERE ${currSosSkuConds} AND toString(flag) = '1' GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, count() as count FROM rb_kw_olap WHERE ${currSosSkuConds} GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, countIf(toInt32(organic) = 1) as count FROM rb_kw_olap WHERE ${prevSosSkuConds} AND toString(flag) = '1' GROUP BY keyword_search_product`),
        queryClickHouse(`SELECT keyword_search_product, count() as count FROM rb_kw_olap WHERE ${prevSosSkuConds} GROUP BY keyword_search_product`)
    ]);

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

    const skuOverview = currSkuMetrics.map((dataRaw, idx) => {
        const skuName = (dataRaw.Product || 'Unknown').trim().replace(/\s+/g, ' ');
        const data = scaleMarsMetrics(dataRaw, skuName);
        const prevDataRaw = prevSkuMap.get(skuName) || {};
        const prevData = scaleMarsMetrics(prevDataRaw, skuName);

        // Current Metrics
        const offtake = parseFloat(data.total_sales || 0);
        const offtakeUnits = parseFloat(data.total_qty || 0);
        const spend = parseFloat(data.total_spend || 0);
        const adSales = parseFloat(data.total_ad_sales || 0);
        const clicks = parseFloat(data.total_clicks || 0);
        const impressions = parseFloat(data.total_impressions || 0);
        const orders = parseFloat(data.total_orders || 0);
        const neno = parseFloat(data.total_neno || 0);
        const deno = parseFloat(data.total_deno || 0);

        const availability = deno > 0 ? (neno / deno) * 100 : 0;
        const roas = spend > 0 ? adSales / spend : 0;
        const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;

        const promoMyBrand = parseFloat(data.my_mrp_val || 0) > 0
            ? ((parseFloat(data.my_mrp_val) - parseFloat(data.my_actual_sales)) / parseFloat(data.my_mrp_val)) * 100
            : 0;
        const promoCompete = parseFloat(data.comp_mrp_val || 0) > 0
            ? ((parseFloat(data.comp_mrp_val) - parseFloat(data.comp_actual_sales)) / parseFloat(data.comp_mrp_val)) * 100
            : 0;

        // Previous Metrics
        const prevOfftake = parseFloat(prevData.total_sales || 0);
        const prevOfftakeUnits = parseFloat(prevData.total_qty || 0);
        const prevSpend = parseFloat(prevData.total_spend || 0);
        const prevAdSales = parseFloat(prevData.total_ad_sales || 0);
        const prevClicks = parseFloat(prevData.total_clicks || 0);
        const prevImpressions = parseFloat(prevData.total_impressions || 0);
        const prevOrders = parseFloat(prevData.total_orders || 0);
        const prevNeno = parseFloat(prevData.total_neno || 0);
        const prevDeno = parseFloat(prevData.total_deno || 0);

        const prevAvailability = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;
        const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
        const prevConversion = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
        const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
        const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

        const prevPromoMyBrand = parseFloat(prevData.my_mrp_val || 0) > 0
            ? ((parseFloat(prevData.my_mrp_val) - parseFloat(prevData.my_actual_sales)) / parseFloat(prevData.my_mrp_val)) * 100
            : 0;
        const prevPromoCompete = parseFloat(prevData.comp_mrp_val || 0) > 0
            ? ((parseFloat(prevData.comp_mrp_val) - parseFloat(prevData.comp_actual_sales)) / parseFloat(prevData.comp_mrp_val)) * 100
            : 0;

        const marketShare = currMarketSize > 0 ? (offtake / currMarketSize) * 100 : 0;
        const prevMarketShare = prevMarketSize > 0 ? (prevOfftake / prevMarketSize) * 100 : 0;

        // SOS, Ad SOV, Organic SOV by keyword_search_product
        const skuKeyLower = skuName.toLowerCase().trim();
        const sosNum = currSosNumSkuMap.get(skuKeyLower) || 0;
        const sosDenom = currSosDenomSkuMap.get(skuKeyLower) || 0;
        const sos = sosDenom > 0 ? (sosNum / sosDenom) * 100 : 0;
        const prevSosNum = prevSosNumSkuMap.get(skuKeyLower) || 0;
        const prevSosDenom = prevSosDenomSkuMap.get(skuKeyLower) || 0;
        const prevSos = prevSosDenom > 0 ? (prevSosNum / prevSosDenom) * 100 : 0;

        const adSovNum = currAdSovNumSkuMap.get(skuKeyLower) || 0;
        const adSovDenom = currAdSovDenomSkuMap.get(skuKeyLower) || 0;
        const adSov = adSovDenom > 0 ? (adSovNum / adSovDenom) * 100 : 0;
        const prevAdSovNum = prevAdSovNumSkuMap.get(skuKeyLower) || 0;
        const prevAdSovDenom = prevAdSovDenomSkuMap.get(skuKeyLower) || 0;
        const prevAdSov = prevAdSovDenom > 0 ? (prevAdSovNum / prevAdSovDenom) * 100 : 0;

        const orgSovNum = currOrgSovNumSkuMap.get(skuKeyLower) || 0;
        const orgSovDenom = currOrgSovDenomSkuMap.get(skuKeyLower) || 0;
        const organicSov = orgSovDenom > 0 ? (orgSovNum / orgSovDenom) * 100 : 0;
        const prevOrgSovNum = prevOrgSovNumSkuMap.get(skuKeyLower) || 0;
        const prevOrgSovDenom = prevOrgSovDenomSkuMap.get(skuKeyLower) || 0;
        const prevOrganicSov = prevOrgSovDenom > 0 ? (prevOrgSovNum / prevOrgSovDenom) * 100 : 0;

        return {
            key: `sku_${idx}_${skuName.toLowerCase().replace(/\s+/g, '_').substring(0, 30)} `,
            label: skuName,
            type: "SKU",
            logo: "https://cdn-icons-png.flaticon.com/512/3502/3502685.png",
            columns: generateKpiColumns({
                offtake, availability, sos, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, promoMyBrand, promoCompete, categorySize: currSkuCategorySize, adSov, organicSov,
                prevOfftake, prevAvailability, prevSos, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete, prevCategorySize: prevSkuCategorySize, prevAdSov, prevOrganicSov,
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

    const { months = 1, startDate: qStartDate, endDate: qEndDate, cityOverviewPlatform, channel } = filters;

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
    const src = await getWatchtowerSource();

    // Build City conditions for rb_pdp_olap
    const buildCityConds = (sDate, eDate) => {
        const dateCol = src.isAgg ? 'date' : 'toDate(DATE)';
        const conds = [`${dateCol} BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];

        const brandCol = src.isAgg ? 'brand' : 'Brand';
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `${brandCol} LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
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

    // Query City metrics for both periods
    const results = await Promise.all([
        queryClickHouse(`
            SELECT ${src.isAgg ? 'location' : 'Location'} as Location,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.sales} ELSE 0 END) as total_sales,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.qty} ELSE 0 END) as total_qty,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.spend} ELSE 0 END) as total_spend,
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales,
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
            SUM(CASE WHEN ${src.f.compFlagMapping} = 0 THEN ${src.f.adSales} ELSE 0 END) as total_ad_sales,
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
            `)
    ]);

    const [currCityMetrics, prevCityMetrics, currMsResult, prevMsResult, currCityCatSize, prevCityCatSize] = results;
    const prevCityMap = new Map(prevCityMetrics.map(d => [d.Location, d]));

    const currMsMap = new Map(currMsResult.map(d => [d.location?.toLowerCase(), parseFloat(d.city_market_sales || 0)]));
    const prevMsMap = new Map(prevMsResult.map(d => [d.location?.toLowerCase(), parseFloat(d.city_market_sales || 0)]));
    const currCityCatSizeMap = new Map(currCityCatSize.map(d => [d.location?.toLowerCase(), parseFloat(d.cat_size || 0)]));
    const prevCityCatSizeMap = new Map(prevCityCatSize.map(d => [d.location?.toLowerCase(), parseFloat(d.cat_size || 0)]));

    const cityOverview = currCityMetrics.map(data => {
        const cityName = data.Location || 'Unknown';
        const prevData = prevCityMap.get(cityName) || {};

        // Current Metrics
        const offtake = parseFloat(data.total_sales || 0);
        const offtakeUnits = parseFloat(data.total_qty || 0);
        const spend = parseFloat(data.total_spend || 0);
        const adSales = parseFloat(data.total_ad_sales || 0);
        const clicks = parseFloat(data.total_clicks || 0);
        const impressions = parseFloat(data.total_impressions || 0);
        const orders = parseFloat(data.total_orders || 0);
        const neno = parseFloat(data.total_neno || 0);
        const deno = parseFloat(data.total_deno || 0);

        const availability = deno > 0 ? (neno / deno) * 100 : 0;
        const roas = spend > 0 ? adSales / spend : 0;
        const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;

        const promoMyBrand = parseFloat(data.my_mrp_val || 0) > 0
            ? ((parseFloat(data.my_mrp_val) - parseFloat(data.my_actual_sales)) / parseFloat(data.my_mrp_val)) * 100
            : 0;
        const promoCompete = parseFloat(data.comp_mrp_val || 0) > 0
            ? ((parseFloat(data.comp_mrp_val) - parseFloat(data.comp_actual_sales)) / parseFloat(data.comp_mrp_val)) * 100
            : 0;

        // Previous Metrics
        const prevOfftake = parseFloat(prevData.total_sales || 0);
        const prevOfftakeUnits = parseFloat(prevData.total_qty || 0);
        const prevSpend = parseFloat(prevData.total_spend || 0);
        const prevAdSales = parseFloat(prevData.total_ad_sales || 0);
        const prevClicks = parseFloat(prevData.total_clicks || 0);
        const prevImpressions = parseFloat(prevData.total_impressions || 0);
        const prevOrders = parseFloat(prevData.total_orders || 0);
        const prevNeno = parseFloat(prevData.total_neno || 0);
        const prevDeno = parseFloat(prevData.total_deno || 0);

        const prevAvailability = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;
        const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
        const prevConversion = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
        const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
        const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

        const prevPromoMyBrand = parseFloat(prevData.my_mrp_val || 0) > 0
            ? ((parseFloat(prevData.my_mrp_val) - parseFloat(prevData.my_actual_sales)) / parseFloat(prevData.my_mrp_val)) * 100
            : 0;
        const prevPromoCompete = parseFloat(prevData.comp_mrp_val || 0) > 0
            ? ((parseFloat(prevData.comp_mrp_val) - parseFloat(prevData.comp_actual_sales)) / parseFloat(prevData.comp_mrp_val)) * 100
            : 0;

        const currCityMarket = currMsMap.get(cityName.toLowerCase()) || 0;
        const prevCityMarket = prevMsMap.get(cityName.toLowerCase()) || 0;

        const marketShare = currCityMarket > 0 ? (offtake / currCityMarket) * 100 : 0;
        const prevMarketShare = prevCityMarket > 0 ? (prevOfftake / prevCityMarket) * 100 : 0;

        return {
            key: cityName.toLowerCase().replace(/\s+/g, '_'),
            label: cityName,
            type: "Location",
            logo: "https://cdn-icons-png.flaticon.com/512/535/535239.png",
            columns: generateKpiColumns({
                offtake, availability, sos: 0, marketShare, spend, roas, inorgSales: adSales, conversion, cpm, cpc, promoMyBrand, promoCompete, categorySize: currCityCatSizeMap.get(cityName.toLowerCase()) || 0,
                prevOfftake, prevAvailability, prevSos: 0, prevMarketShare, prevSpend, prevRoas, prevInorgSales: prevAdSales, prevConversion, prevCpm, prevCpc, prevPromoMyBrand, prevPromoCompete, prevCategorySize: prevCityCatSizeMap.get(cityName.toLowerCase()) || 0,
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
        const platformClause = filters.platform_uuid && filters.platform_uuid !== 'All' ? `AND Platform = '${filters.platform_uuid}'` : '';
        const groupByMap = {
            'category': PRODUCT_CATEGORY_SQL,
            'brand': 'Brand',
            'sku': 'Product'
        };
        const groupByCol = groupByMap[filters.group_by] || PRODUCT_CATEGORY_SQL;

        let dateClause = '';
        if (filters.start_date && filters.end_date) {
            dateClause = `AND DATE >= '${filters.start_date}' AND DATE <= '${filters.end_date}'`;
        } else {
            const todayStr = new Date().toISOString().split('T')[0];
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 30);
            const pastStr = pastDate.toISOString().split('T')[0];
            dateClause = `AND DATE >= '${pastStr}' AND DATE <= '${todayStr}'`;
        }

        const src = await getWatchtowerSource();
        const platCol = src.f.platform;
        const compFlagCol = src.f.compFlag;

        const totalSpendsQuery = `
            SELECT SUM(${src.f.spend}) as total
            FROM ${src.table} 
            WHERE ${compFlagCol} = 0 ${platformClause.replace('Platform', platCol)} ${dateClause.replace('DATE', src.f.date)}
        `;
        const totalSpendsResult = await queryClickHouse(totalSpendsQuery);
        const total_spends = parseFloat(totalSpendsResult[0]?.total || 0);

        const query = `
        SELECT
                ${groupByCol} AS tag,
            SUM(${src.f.impressions}) AS group_impressions,
                SUM(${src.f.clicks}) AS group_clicks,
                if (group_impressions > 0, (group_clicks / group_impressions) * 100, 0) AS ctr,
            SUM(${src.f.spend}) AS group_spends,
                if (${total_spends} > 0, (group_spends / ${total_spends}) * 100, 0) AS spend_percent_share,
                if (group_clicks > 0, group_spends / group_clicks, 0) AS cpc,
            SUM(${src.f.quantitySold}) AS group_orders,
                if (group_clicks > 0, (group_orders / group_clicks) * 100, 0) AS cvr,
            SUM(${src.f.sales}) AS group_sales
            FROM ${src.table}
            WHERE ${compFlagCol} = 0
            ${platformClause.replace('Platform', platCol)}
            ${dateClause.replace('DATE', src.f.date)}
            GROUP BY ${groupByCol}
            ORDER BY group_spends DESC
        `;

        const data = await queryClickHouse(query);

        let totals = {
            impressions: 0, clicks: 0, ctr: 0, spends: 0, cpc: 0, orders: 0, cvr: 0, sales: 0
        };

        const parsedData = data.map(row => {
            const scaled = scaleMarsMetrics(row, row.tag);
            const impressions = parseFloat(scaled.group_impressions) || 0;
            const clicks = parseFloat(scaled.group_clicks) || 0;
            const spends = parseFloat(scaled.group_spends) || 0;
            const orders = parseFloat(scaled.group_orders) || 0;
            const sales = parseFloat(scaled.group_sales) || 0;

            totals.impressions += impressions;
            totals.clicks += clicks;
            totals.spends += spends;
            totals.orders += orders;
            totals.sales += sales;

            return {
                tag: scaled.tag || 'Unknown',
                impressions,
                clicks,
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                spends,
                cpc: clicks > 0 ? spends / clicks : 0,
                orders,
                cvr: clicks > 0 ? (orders / clicks) * 100 : 0,
                sales
            };
        });

        // Add spend_percent_share after totals are calculated
        parsedData.forEach(item => {
            item.spend_percent_share = totals.spends > 0 ? (item.spends / totals.spends) * 100 : 0;
        });

        totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
        totals.cpc = totals.clicks > 0 ? (totals.spends / totals.clicks) : 0;
        totals.cvr = totals.clicks > 0 ? (totals.orders / totals.clicks) * 100 : 0;

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

            const periodQueries = periodKeys.map(async (periodParam) => {
                // Parse: preset keys are plain (e.g. "last_week"), custom are "custom_<ts>:<start>:<end>"
                let key = periodParam;
                let range = null;

                if (periodParam.includes(':')) {
                    // Custom period format: "custom_123456:2026-01-11:2026-01-15"
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

                if (!range) {
                    return { key, data: [] };
                }

                const periodDateClause = `AND ${src.f.date} >= '${fmtDate(range.start)}' AND ${src.f.date} <= '${fmtDate(range.end)}'`;
                const periodQuery = `
        SELECT
                        ${groupByCol} AS tag,
            SUM(${src.f.impressions}) AS group_impressions,
                SUM(${src.f.clicks}) AS group_clicks,
                        if (group_impressions > 0, (group_clicks / group_impressions) * 100, 0) AS ctr,
            SUM(${src.f.spend}) AS group_spends,
                        if (group_clicks > 0, group_spends / group_clicks, 0) AS cpc,
            SUM(${src.f.quantitySold}) AS group_orders,
                        if (group_clicks > 0, (group_orders / group_clicks) * 100, 0) AS cvr,
            SUM(${src.f.sales}) AS group_sales
                    FROM ${src.table}
                    WHERE ${compFlagCol} = 0 ${platformClause.replace('Platform', platCol)} ${periodDateClause}
                    GROUP BY ${groupByCol}
                    ORDER BY group_spends DESC
                `;
                const periodData = await queryClickHouse(periodQuery);
                return {
                    key,
                    data: periodData.map(r => {
                        const scaled = scaleMarsMetrics(r, r.tag);
                        return {
                            tag: scaled.tag || 'Unknown',
                            impressions: parseFloat(scaled.group_impressions) || 0,
                            clicks: parseFloat(scaled.group_clicks) || 0,
                            ctr: parseFloat(scaled.ctr) || 0, // ClickHouse calculated, but let's re-calculate to be safe if desired? Actually CTR is ratio, doesn't change if both scaled.
                            spends: parseFloat(scaled.group_spends) || 0,
                            cpc: parseFloat(scaled.cpc) || 0,
                            orders: parseFloat(scaled.group_orders) || 0,
                            cvr: parseFloat(scaled.cvr) || 0,
                            sales: parseFloat(scaled.group_sales) || 0
                        };
                    })
                };
            });

            const periodResults = await Promise.all(periodQueries);
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
            conditions.push(`${src.f.platform} IN (${platArr.map(p => `'${escapeStr(p)}'`).join(', ')})`);
        }
        if (bndArr && bndArr.length > 0) {
            conditions.push(`${src.f.brand} IN (${bndArr.map(b => `'${escapeStr(b)}'`).join(', ')})`);
        }
        if (catArr && catArr.length > 0) {
            const catCol = src.f.category;
            conditions.push(`${catCol} IN (${catArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        const query = `SELECT DISTINCT ${src.f.product} as Product FROM ${src.table} WHERE ${conditions.join(' AND ')} ORDER BY Product LIMIT 500`;
        const results = await queryClickHouse(query);
        return results.map(r => r.Product).filter(Boolean).sort();
    } catch (error) {
        console.error("[getProducts] Error:", error);
        return [];
    }
};

const getProductCategories = async (filters = {}) => {
    try {
        const { platform, channel } = filters;
        const query = `
            SELECT DISTINCT Category as category
            FROM rb_pdp_olap
            WHERE Category IS NOT NULL AND Category != ''
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

export default {
    getSummaryMetrics,
    getTrendData,
    getPlatforms,
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
    getProductCategories,
    getChannels
};
