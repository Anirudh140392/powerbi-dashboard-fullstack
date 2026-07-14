import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getTableColumns, resolveColumn, columnExists } from '../utils/schemaHelper.js';

// ── Database-Scoped Cache ─────────────────────────────────────
const dbScopedCaches = new Map();

const getDbCache = () => {
    const dbName = getCurrentDbName();
    if (!dbScopedCaches.has(dbName)) {
        dbScopedCaches.set(dbName, {
            maxDate: { date: null, timestamp: 0, promise: null },
            ourBrands: { data: null, timestamp: 0, promise: null }
        });
    }
    return dbScopedCaches.get(dbName);
};

const MAX_DATE_TTL = 10 * 60 * 1000; // 10 min
const DISTINCT_CACHE_TTL = 10 * 60 * 1000; // 10 min

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
            const result = await queryClickHouse(`SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap`);
            const maxDateStr = result?.[0]?.maxDate;
            const maxDate = maxDateStr ? dayjs(maxDateStr).endOf('day') : dayjs().endOf('day');
            dbCache.maxDate = { date: maxDate, timestamp: Date.now(), promise: null };
            console.log(`🎯 [MaxDate][MapIntellect][${getCurrentDbName()}] Latest date: ${maxDate.format('YYYY-MM-DD')}`);
            return maxDate;
        } catch (error) {
            console.error('[MapIntellect] Error fetching max date:', error);
            return dayjs().endOf('day');
        } finally {
            dbCache.maxDate.promise = null;
        }
    })();

    return dbCache.maxDate.promise;
};

/**
 * Get cached brands list where comp_flag = 0
 */
const getOurBrandsList = async () => {
    const dbCache = getDbCache();
    if (dbCache.ourBrands.data && (Date.now() - dbCache.ourBrands.timestamp) < DISTINCT_CACHE_TTL) {
        return dbCache.ourBrands.data;
    }

    if (dbCache.ourBrands.promise) return dbCache.ourBrands.promise;

    dbCache.ourBrands.promise = (async () => {
        try {
            const query = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
            const results = await queryClickHouse(query);
            const brands = results.map(b => b.brand_name).filter(Boolean);
            
            // Mars fallback if rca_sku_dim is not populated
            if (brands.length === 0 && getCurrentDbName() === 'mars') {
                const marsBrands = ['Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's", 'Orbit', 'Skittles', 'Boomer', 'Doublemint', 'Skittles', 'Gum', 'Chocolates'];
                dbCache.ourBrands = { data: marsBrands, timestamp: Date.now(), promise: null };
                return marsBrands;
            }

            dbCache.ourBrands = { data: brands, timestamp: Date.now(), promise: null };
            console.log(`🎯 [OurBrands][MapIntellect][${getCurrentDbName()}] Found ${brands.length} brands`);
            return brands;
        } catch (error) {
            console.error('[MapIntellect] Error fetching brands:', error);
            return [];
        } finally {
            dbCache.ourBrands.promise = null;
        }
    })();

    return dbCache.ourBrands.promise;
};

// ── Dynamic Source Resolution ─────────────────────────────────────

async function checkTableExists(tableName) {
    try {
        const dbName = getCurrentDbName();
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        return result?.[0]?.result === 1 || result?.[0]?.result === '1';
    } catch (error) {
        console.error(`[MapIntellect] Error checking table exists (${tableName}):`, error.message);
        return false;
    }
}

async function getGeoSource() {
    const tableName = 'rb_pdp_olap';
    const cols = await getTableColumns(tableName);
    const r = (name) => resolveColumn(cols, name);

    // Optimized: Only wrap if necessary. Simple columns like DATE, Platform, Location 
    // usually don't need wrapping IF we know their types, but to be safe and dynamic
    // we use a lighter wrap or only wrap numeric metrics.
    const wrap = (col, type = 'float') => {
        // If column doesn't exist in map (resolved to itself but not in DB), return '0' or NULL
        if (!col) return '0';
        return `ifNull(toFloat64OrZero(toString(${col})), 0)`;
    };

    const hasMsl = columnExists(cols, 'msl');

    return {
        table: tableName,
        f: {
            sales: wrap(r('Sales')),
            qty: wrap(r('Qty_Sold')),
            orders: wrap(r('Qty_Sold'), 'float'),
            neno: wrap(r('neno_osa')),
            deno: wrap(r('deno_osa')),
            listing: r('listing_percent'),
            location: r('Location'),
            date: r('DATE'),
            platform: r('Platform'),
            category: r('Category', r('Product_type')),
            compFlag: r('Comp_flag'),
            msl: hasMsl ? r('msl') : null
        }
    };
}

async function getMsGeoSource() {
    const tableName = 'rb_ms_olap';
    const exists = await checkTableExists(tableName);
    if (!exists) return null;

    const cols = await getTableColumns(tableName);
    const r = (name) => resolveColumn(cols, name);
    const wrap = (col) => `ifNull(toFloat64OrZero(toString(${col})), 0)`;

    return {
        table: tableName,
        f: {
            sales: wrap(r('sales')),
            groupBrand: r('group_brand'),
            location: r('location'),
            date: r('created_on'),
            platform: r('platform'),
            category: r('category')
        }
    };
}

// ── Helpers ───────────────────────────────────────────────────────

const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

const normalizeFilterArray = (value) => {
    if (!value) return null;
    if (value === 'All') return null;
    if (Array.isArray(value) && (value.length === 0 || value.includes('All'))) return null;
    if (typeof value === 'string' && value.includes(',')) {
        const arr = value.split(',').map(v => v.trim()).filter(Boolean);
        return arr.length > 0 ? arr : null;
    }
    return Array.isArray(value) ? value : [value];
};

const calcChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

const formatLac = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${Math.round(val)}`;
};

// ── Main Data Function ───────────────────────────────────────────

const getMapIntellectData = async (filters) => {
    console.log(`[MapIntellect][${getCurrentDbName()}] Computing dynamic data:`, JSON.stringify(filters));

    const { months, days, startDate: qStartDate, endDate: qEndDate, metric = 'all', category, channel, msl } = filters;
    const platform = filters.platform || 'All';

    // Date range
    let endDate = await getCachedMaxDate();
    let startDate;

    if (qStartDate && qEndDate) {
        startDate = dayjs(qStartDate).startOf('day');
        endDate = dayjs(qEndDate).endOf('day');
    } else if (days) {
        const daysBack = parseInt(days, 10) || 7;
        startDate = endDate.subtract(daysBack - 1, 'day').startOf('day');
    } else {
        const monthsBack = parseInt(months, 10) || 1;
        startDate = endDate.subtract(monthsBack, 'month').startOf('day');
    }

    const prevStartDate = startDate.subtract(1, 'month').startOf('day');
    const prevEndDate = endDate.subtract(1, 'month').endOf('day');

    // Get dynamic sources
    const [pdpSrc, msSrc, ourBrands] = await Promise.all([
        getGeoSource(),
        getMsGeoSource(),
        getOurBrandsList()
    ]);

    const buildConds = (src, sDate, eDate) => {
        if (!src) return '1=0';
        const conds = [`toDate(${src.f.date}) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        if (platform && platform !== 'All') {
            const list = platform.split(',').map(p => p.trim().toLowerCase());
            conds.push(`lower(${src.f.platform}) IN (${list.map(p => `'${escapeStr(p)}'`).join(',')})`);
        } else if (channel && channel !== 'All') {
            conds.push(`${src.f.platform} IN (SELECT DISTINCT platform FROM rca_sku_dim WHERE channel = '${escapeStr(channel)}')`);
        }
        if (category && category !== 'All') {
            conds.push(`lower(${src.f.category}) = '${escapeStr(category.toLowerCase())}'`);
        }
        if (src.f.compFlag) {
            conds.push(`${src.f.compFlag} = 0`);
        }
        if (src.f.msl && msl) {
            const mslArr = normalizeFilterArray(msl);
            if (mslArr && mslArr.includes('1') && !mslArr.includes('0')) {
                conds.push(`toString(${src.f.msl}) = '1'`);
            }
        }
        return conds.join(' AND ');
    };

    const currPdpConds = buildConds(pdpSrc, startDate, endDate);
    const prevPdpConds = buildConds(pdpSrc, prevStartDate, prevEndDate);


    const isMarketShareOnly = metric === 'marketshare' || metric === 'Market Share';

    let currCityData = [];
    let prevCityData = [];
    let currMsData = [];
    let prevMsData = [];

    // ── Fetch PDP data ──
    if (!isMarketShareOnly && pdpSrc) {
        const pdpQuery = (conds) => `
            SELECT
                ${pdpSrc.f.location} AS Location,
                SUM(${pdpSrc.f.sales}) AS total_sales,
                SUM(${pdpSrc.f.qty}) AS total_qty,
                SUM(${pdpSrc.f.orders}) AS total_orders,
                (SUM(${pdpSrc.f.neno}) / NULLIF(SUM(${pdpSrc.f.deno}), 0)) * 100 AS city_osa,
                AVG(if(toFloat64OrZero(toString(${pdpSrc.f.listing})) > 0, toFloat64OrZero(toString(${pdpSrc.f.listing})), (${pdpSrc.f.neno} / NULLIF(${pdpSrc.f.deno}, 0)) * 100)) AS city_listing
            FROM ${pdpSrc.table}
            WHERE ${conds}
              AND ${pdpSrc.f.location} IS NOT NULL AND ${pdpSrc.f.location} != ''
            GROUP BY Location
            ORDER BY total_sales DESC
            LIMIT 500
        `;

        [currCityData, prevCityData] = await Promise.all([
            queryClickHouse(pdpQuery(currPdpConds)),
            queryClickHouse(pdpQuery(prevPdpConds))
        ]);
    }

    // ── Fetch Market Share data ──
    if (msSrc) {
        try {
            const currentDb = getCurrentDbName()?.toLowerCase() || '';
            let allowedMsCities = [
                "Delhi", "Ahmedabad", "Bengaluru", "Bangalore", "Banglore", "Bengalore", "Chandigarh", "Chennai",
                "Faridabad", "Gurugram", "Gurgaon", "Hyderabad", "Kolkata", "Lucknow",
                "Mumbai", "Pune", "India", "Nation", "National"
            ];
            if (currentDb === 'mamaearth') {
                allowedMsCities = allowedMsCities.filter(c => c !== "Ahmedabad");
            }
            const cityConditions = allowedMsCities.map(c => `lower(${msSrc.f.location}) LIKE '%${escapeStr(c.toLowerCase())}%'`).join(' OR ');

            let brandsCondition = 'FALSE';
            if (ourBrands.length > 0) {
                brandsCondition = ourBrands.map(b => `lower(${msSrc.f.groupBrand}) LIKE '%${escapeStr(b.toLowerCase())}%'`).join(' OR ');
            }

            const msQueryBase = (sDate, eDate) => `
                SELECT 
                    ${msSrc.f.location} AS location,
                    ROUND(
                        (
                            SUM(
                                CASE WHEN ${brandsCondition}
                                THEN ${msSrc.f.sales} 
                                ELSE 0 
                                END
                            ) / NULLIF(SUM(${msSrc.f.sales}), 0)
                        ) * 100, 
                    2) AS avg_market_share,
                    COUNT(DISTINCT ${msSrc.f.groupBrand}) AS total_brands
                FROM ${msSrc.table}
                WHERE toDate(${msSrc.f.date}) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'
                  AND (${cityConditions})
                  AND ${msSrc.f.location} IS NOT NULL AND ${msSrc.f.location} != ''
                  ${platform && platform !== 'All' ? `AND lower(${msSrc.f.platform}) IN (${platform.split(',').map(p => `'${escapeStr(p.trim().toLowerCase())}'`).join(',')})` : (channel && channel !== 'All' ? `AND ${msSrc.f.platform} IN (SELECT DISTINCT platform FROM rca_sku_dim WHERE channel = '${escapeStr(channel)}')` : '')}
                  ${category && category !== 'All' ? `AND lower(${msSrc.f.category}) = '${escapeStr(category.toLowerCase())}'` : ''}
                GROUP BY location
            `;

            [currMsData, prevMsData] = await Promise.all([
                queryClickHouse(msQueryBase(startDate, endDate)),
                queryClickHouse(msQueryBase(prevStartDate, prevEndDate))
            ]);

            // Filter out cities with only 1 brand (no competitive data → misleading 100%)
            // Relaxed brand filter for better data visibility across all schemas
            // Previously: currMsData = (currMsData || []).filter(d => parseInt(d.total_brands || 0) > 1);
            currMsData = (currMsData || []);
            prevMsData = (prevMsData || []);
        } catch (e) {
            console.error('[MapIntellect] Error querying market share:', e.message);
        }
    }

    // ── Build maps for comparison ──
    const normalizeCity = (name) => {
        let n = (name || '').trim().toLowerCase();
        if (n.includes('bangalore') || n.includes('bengalore') || n.includes('banglore') || n.includes('bengaluru')) return 'bengaluru';
        if (n.includes('gurgaon') || n.includes('gurugram')) return 'gurugram';
        if (n.includes('delhi')) return 'delhi';
        if (n.includes('mumbai') || n.includes('bombay')) return 'mumbai';
        return n;
    };

    const prevPdpMap = new Map((prevCityData || []).map(d => [d.Location, d]));
    const currMsMap = new Map((currMsData || []).map(d => [normalizeCity(d.location), parseFloat(d.avg_market_share || 0)]));
    const prevMsMap = new Map((prevMsData || []).map(d => [normalizeCity(d.location), parseFloat(d.avg_market_share || 0)]));

    // ── Merge and Process ──
    let resultCities = [];

    if (isMarketShareOnly) {
        resultCities = (currMsData || []).map(data => {
            let cityName = (data.location || '').trim();
            const lowerCity = cityName.toLowerCase();
            if (lowerCity.includes('bangalore') || lowerCity.includes('bengalore') || lowerCity.includes('banglore') || lowerCity.includes('bengaluru')) cityName = 'Bengaluru';
            if (lowerCity.includes('gurgaon') || lowerCity.includes('gurugram')) cityName = 'Gurugram';
            
            if (cityName) {
                cityName = cityName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }

            const cityKey = cityName.toLowerCase();
            if (!cityName || cityKey === 'unknown' || cityKey === 'other') return null;

            const ms = parseFloat(data.avg_market_share || 0);
            const prevMs = prevMsMap.get(cityKey) || 0;

            return {
                name: cityName,
                sales: 0, salesFormatted: '₹0', salesChange: 0,
                orders: 0, ordersChange: 0,
                osa: 0, osaChange: 0,
                marketShare: parseFloat(ms.toFixed(2)),
                marketShareChange: parseFloat(calcChange(ms, prevMs).toFixed(2)),
                qty: 0,
                listingPercentage: 0
            };
        }).filter(Boolean);
    } else {
        resultCities = (currCityData || []).map(data => {
            let cityName = (data.Location || '').trim();
            const lowerCity = cityName.toLowerCase();
            if (lowerCity.includes('bangalore') || lowerCity.includes('bengalore') || lowerCity.includes('banglore') || lowerCity.includes('bengaluru')) cityName = 'Bengaluru';
            if (lowerCity.includes('gurgaon') || lowerCity.includes('gurugram')) cityName = 'Gurugram';

            if (cityName) {
                cityName = cityName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }

            const cityKey = cityName.toLowerCase();
            if (!cityName || cityKey === 'unknown' || cityKey === 'other') return null;

            const prevData = prevPdpMap.get(data.Location) || {};
            const sales = parseFloat(data.total_sales || 0);
            const qty = parseFloat(data.total_qty || 0);
            const orders = parseFloat(data.total_orders || 0);
            const osa = parseFloat(data.city_osa || 0);

            const prevSales = parseFloat(prevData.total_sales || 0);
            const prevOrders = parseFloat(prevData.total_orders || 0);
            const prevOsa = parseFloat(prevData.city_osa || 0);

            const ms = currMsMap.get(cityKey) || 0;
            const prevMs = prevMsMap.get(cityKey) || 0;

            return {
                name: cityName,
                sales: sales,
                salesFormatted: formatLac(sales),
                salesChange: parseFloat(calcChange(sales, prevSales).toFixed(1)),
                orders: Math.round(orders),
                ordersChange: parseFloat(calcChange(orders, prevOrders).toFixed(1)),
                osa: parseFloat(osa.toFixed(1)),
                osaChange: parseFloat(calcChange(osa, prevOsa).toFixed(1)),
                marketShare: parseFloat(ms.toFixed(2)),
                marketShareChange: parseFloat(calcChange(ms, prevMs).toFixed(2)),
                qty: Math.round(qty),
                listingPercentage: parseFloat((data.city_listing || 0).toFixed(1))
            };
        }).filter(Boolean);
    }

    return {
        cities: resultCities,
        period: {
            startDate: startDate.format('YYYY-MM-DD'),
            endDate: endDate.format('YYYY-MM-DD'),
        }
    };
};

/**
 * Fetch distinct categories based on metric and platform
 */
const getMapIntellectCategories = async (metric, platform, channel) => {
    const isMarketShare = metric === 'Market Share';
    const src = isMarketShare ? await getMsGeoSource() : await getGeoSource();

    if (!src) return [];

    let query = `SELECT DISTINCT ${src.f.category} as category FROM ${src.table} WHERE ${src.f.category} IS NOT NULL AND ${src.f.category} != ''`;

    if (platform && platform !== 'All') {
        const list = platform.split(',').map(p => p.trim().toLowerCase());
        query += ` AND lower(${src.f.platform}) IN (${list.map(p => `'${escapeStr(p)}'`).join(',')})`;
    } else if (channel && channel !== 'All') {
        query += ` AND ${src.f.platform} IN (SELECT DISTINCT platform FROM rca_sku_dim WHERE channel = '${escapeStr(channel)}')`;
    }

    query += ` ORDER BY category`;

    try {
        const results = await queryClickHouse(query);
        return results.map(r => r.category).filter(Boolean);
    } catch (error) {
        console.error('[MapIntellect] Error fetching categories:', error);
        return [];
    }
};

export default {
    getMapIntellectData,
    getMapIntellectCategories
};
