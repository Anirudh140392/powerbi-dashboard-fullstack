/**
 * Map Intellect Service
 * Provides city-level KPI data for the Map Intellect (Geo Intelligence) page.
 * Queries ClickHouse rb_pdp_olap grouped by Location.
 */

import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

// ── Cached max date (shared light cache) ─────────────────────────
let cachedMaxDate = { date: null, timestamp: 0 };
const MAX_DATE_TTL = 10 * 60 * 1000; // 10 min

const getCachedMaxDate = async () => {
    if (cachedMaxDate.date && (Date.now() - cachedMaxDate.timestamp) < MAX_DATE_TTL) {
        return cachedMaxDate.date;
    }
    try {
        const result = await queryClickHouse(`SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap`);
        const maxDateStr = result?.[0]?.maxDate;
        const maxDate = maxDateStr ? dayjs(maxDateStr).endOf('day') : dayjs().endOf('day');
        cachedMaxDate = { date: maxDate, timestamp: Date.now() };
        return maxDate;
    } catch (error) {
        console.error('[MapIntellect] Error fetching max date:', error);
        return dayjs().endOf('day');
    }
};

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

const buildPlatformCond = (platform) => {
    if (!platform || platform === 'All') return null;
    const platforms = Array.isArray(platform) ? platform : (typeof platform === 'string' && platform.includes(',') ? platform.split(',') : [platform]);
    if (platforms.length === 1) {
        return `Platform = '${escapeStr(platforms[0])}'`;
    }
    const list = platforms.map(p => `'${escapeStr(p.trim())}'`).join(', ');
    return `Platform IN (${list})`;
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

/**
 * Get city-level KPI data for the Map Intellect page
 * @param {Object} filters - { platform, startDate, endDate, months, brand, category }
 * @returns {Object} { cities: [...], period: { startDate, endDate } }
 */
const getMapIntellectData = async (filters) => {
    console.log('[MapIntellect] Computing city-level data with filters:', JSON.stringify(filters));

    const { months = 1, startDate: qStartDate, endDate: qEndDate } = filters;
    const platform = filters.platform || 'All';

    // Extract filter arrays
    const brandArr = normalizeFilterArray(filters['brand[]'] || filters.brand);
    const categoryArr = normalizeFilterArray(filters['category[]'] || filters.category);

    const monthsBack = parseInt(months, 10) || 1;

    // Date range
    let endDate = await getCachedMaxDate();
    let startDate = endDate.subtract(monthsBack, 'month').startOf('day');
    if (qStartDate && qEndDate) {
        startDate = dayjs(qStartDate).startOf('day');
        endDate = dayjs(qEndDate).endOf('day');
    }

    // Previous period (same duration)
    const diff = endDate.diff(startDate, 'day') + 1;
    const prevEndDate = startDate.subtract(1, 'day').endOf('day');
    const prevStartDate = prevEndDate.subtract(diff - 1, 'day').startOf('day');

    // Build WHERE conditions
    const buildConds = (sDate, eDate) => {
        const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const pCond = buildPlatformCond(platform);
        if (pCond) conds.push(pCond);
        if (brandArr && brandArr.length > 0) {
            conds.push(`(${brandArr.map(b => `Brand LIKE '%${escapeStr(b)}%'`).join(' OR ')})`);
        }
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`Category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    const currConds = buildConds(startDate, endDate);
    const prevConds = buildConds(prevStartDate, prevEndDate);

    // Build MS conditions
    const buildMsConds = (sDate, eDate) => {
        const conds = [`toDate(created_on) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        conds.push(`sales IS NOT NULL`);
        const pCond = buildPlatformCond(platform);
        if (pCond) conds.push(pCond);
        if (categoryArr && categoryArr.length > 0) {
            conds.push(`category IN (${categoryArr.map(c => `'${escapeStr(c)}'`).join(', ')})`);
        }
        return conds.join(' AND ');
    };

    // Execute queries in parallel
    const [currCityData, prevCityData, currMsData, prevMsData] = await Promise.all([
        queryClickHouse(`
            SELECT Location,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END) as total_sales,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(Qty_Sold)), 0) ELSE 0 END) as total_qty,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0) ELSE 0 END) as total_orders,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(neno_osa)), 0) ELSE 0 END) as total_neno,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(deno_osa)), 0) ELSE 0 END) as total_deno
            FROM rb_pdp_olap
            WHERE ${currConds} AND Location IS NOT NULL AND Location != ''
            GROUP BY Location
            ORDER BY total_sales DESC
        `),
        queryClickHouse(`
            SELECT Location,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(Sales)), 0) ELSE 0 END) as total_sales,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(Qty_Sold)), 0) ELSE 0 END) as total_qty,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0) ELSE 0 END) as total_orders,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(neno_osa)), 0) ELSE 0 END) as total_neno,
                SUM(CASE WHEN Comp_flag = 0 THEN ifNull(toFloat64OrZero(toString(deno_osa)), 0) ELSE 0 END) as total_deno
            FROM rb_pdp_olap
            WHERE ${prevConds} AND Location IS NOT NULL AND Location != ''
            GROUP BY Location
        `),
        // Market size by location
        queryClickHouse(`SELECT Location, SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as city_market_sales FROM rb_brand_ms WHERE ${buildMsConds(startDate, endDate)} GROUP BY Location`),
        queryClickHouse(`SELECT Location, SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as city_market_sales FROM rb_brand_ms WHERE ${buildMsConds(prevStartDate, prevEndDate)} GROUP BY Location`),
    ]);

    // Build lookup maps
    const prevMap = new Map(prevCityData.map(d => [d.Location, d]));
    const currMsMap = new Map(currMsData.map(d => [d.Location?.toLowerCase(), parseFloat(d.city_market_sales || 0)]));
    const prevMsMap = new Map(prevMsData.map(d => [d.Location?.toLowerCase(), parseFloat(d.city_market_sales || 0)]));

    // Process city data
    const cities = currCityData.map(data => {
        const cityName = data.Location || 'Unknown';
        const prevData = prevMap.get(cityName) || {};

        // Current KPIs
        const sales = parseFloat(data.total_sales || 0);
        const qty = parseFloat(data.total_qty || 0);
        const orders = parseFloat(data.total_orders || 0);
        const neno = parseFloat(data.total_neno || 0);
        const deno = parseFloat(data.total_deno || 0);
        const osa = deno > 0 ? (neno / deno) * 100 : 0;

        const currCityMarket = currMsMap.get(cityName.toLowerCase()) || 0;
        const marketShare = currCityMarket > 0 ? (sales / currCityMarket) * 100 : 0;

        // Previous KPIs
        const prevSales = parseFloat(prevData.total_sales || 0);
        const prevQty = parseFloat(prevData.total_qty || 0);
        const prevOrders = parseFloat(prevData.total_orders || 0);
        const prevNeno = parseFloat(prevData.total_neno || 0);
        const prevDeno = parseFloat(prevData.total_deno || 0);
        const prevOsa = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;

        const prevCityMarket = prevMsMap.get(cityName.toLowerCase()) || 0;
        const prevMarketShare = prevCityMarket > 0 ? (prevSales / prevCityMarket) * 100 : 0;

        return {
            name: cityName,
            sales: sales,
            salesFormatted: formatLac(sales),
            salesChange: parseFloat(calcChange(sales, prevSales).toFixed(1)),
            orders: Math.round(orders),
            ordersChange: parseFloat(calcChange(orders, prevOrders).toFixed(1)),
            osa: parseFloat(osa.toFixed(1)),
            osaChange: parseFloat(calcChange(osa, prevOsa).toFixed(1)),
            marketShare: parseFloat(marketShare.toFixed(1)),
            marketShareChange: parseFloat(calcChange(marketShare, prevMarketShare).toFixed(1)),
            qty: Math.round(qty),
        };
    }).filter(c => c.name.toLowerCase() !== 'unknown' && c.name.toLowerCase() !== 'other');

    console.log(`[MapIntellect] Returning ${cities.length} cities`);

    return {
        cities,
        period: {
            startDate: startDate.format('YYYY-MM-DD'),
            endDate: endDate.format('YYYY-MM-DD'),
        }
    };
};

export default {
    getMapIntellectData,
};
