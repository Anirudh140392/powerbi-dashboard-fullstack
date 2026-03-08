/**
 * Map Intellect Service
 * Provides city-level KPI data for the Map Intellect (Geo Intelligence) page.
 * - OSA / Sales / Orders  → rb_pdp_olap  (Platform + Date filters only, all Locations)
 * - Market Share          → rb_brand_ms   (Platform + Date + hardcoded brand/city lists)
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

// ── Constants for Market Share (rb_brand_ms) ─────────────────────

const MS_BRANDS = [
    'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
    'Orbit', 'Skittles', 'Boomer', "Wrigley's Doublemint"
];
const MS_BRANDS_SQL = MS_BRANDS.map(b => `'${escapeStr(b)}'`).join(', ');

const MS_LOCATIONS = [
    'Delhi', 'Ahmedabad', 'Bengaluru', 'Chandigarh', 'Chennai',
    'Faridabad', 'Gurugram', 'Hyderabad', 'Kolkata', 'Lucknow',
    'Mumbai', 'Pune'
];
const MS_LOCATIONS_SQL = MS_LOCATIONS.map(l => `'${escapeStr(l)}'`).join(', ');

// ── Main Data Function ───────────────────────────────────────────

/**
 * Get city-level KPI data for the Map Intellect page
 * @param {Object} filters - { platform, startDate, endDate, months, brand, category, metric }
 * @returns {Object} { cities: [...], period: { startDate, endDate } }
 */
const getMapIntellectData = async (filters) => {
    console.log('[MapIntellect] Computing city-level data with filters:', JSON.stringify(filters));

    const { months = 1, startDate: qStartDate, endDate: qEndDate, metric = 'all' } = filters;
    const platform = filters.platform || 'All';

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

    // ── Platform condition for rb_pdp_olap (uses "Platform" column) ──
    const buildPdpPlatformCond = () => {
        if (!platform || platform === 'All') return null;
        return `Platform LIKE '%${escapeStr(platform)}%'`;
    };

    // ── Build WHERE for rb_pdp_olap — Platform + Date ONLY ──
    const buildPdpConds = (sDate, eDate) => {
        const conds = [`toDate(DATE) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        const pCond = buildPdpPlatformCond();
        if (pCond) conds.push(pCond);
        return conds.join(' AND ');
    };

    // ── Build WHERE for rb_brand_ms — Platform + Date ONLY ──
    const buildMsConds = (sDate, eDate) => {
        const conds = [`toDate(created_on) BETWEEN '${sDate.format('YYYY-MM-DD')}' AND '${eDate.format('YYYY-MM-DD')}'`];
        if (platform && platform !== 'All') {
            conds.push(`Platform LIKE '%${escapeStr(platform)}%'`);
        }
        return conds.join(' AND ');
    };

    const currPdpConds = buildPdpConds(startDate, endDate);
    const prevPdpConds = buildPdpConds(prevStartDate, prevEndDate);

    // Determine which data to fetch based on metric
    const isMarketShare = metric === 'marketshare' || metric === 'Market Share';
    const isPdpMetric = !isMarketShare; // everything else is PDP-based

    let currCityData = [];
    let prevCityData = [];
    let currMsData  = [];
    let prevMsData  = [];

    // ── Fetch PDP data (Wt. OSA / Sales / Orders) from rb_pdp_olap ──
    // OSA formula: SUM(neno_osa) / NULLIF(SUM(deno_osa), 0) * 100  (exact user-specified logic)
    if (isPdpMetric) {
        [currCityData, prevCityData] = await Promise.all([
            queryClickHouse(`
                SELECT
                    Location,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0))          AS total_sales,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0))        AS total_qty,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)) AS total_orders,
                    (
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) /
                        NULLIF(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)
                    ) * 100 AS city_osa
                FROM rb_pdp_olap
                WHERE ${currPdpConds}
                  AND Location IS NOT NULL AND Location != ''
                GROUP BY Location
                ORDER BY total_sales DESC
                LIMIT 200
            `),
            queryClickHouse(`
                SELECT
                    Location,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0))          AS total_sales,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0))        AS total_qty,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)) AS total_orders,
                    (
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) /
                        NULLIF(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)
                    ) * 100 AS city_osa
                FROM rb_pdp_olap
                WHERE ${prevPdpConds}
                  AND Location IS NOT NULL AND Location != ''
                GROUP BY Location
            `)
        ]);
        console.log(`[MapIntellect] PDP locations: curr=${currCityData.length}, prev=${prevCityData.length}`);
    }

    // ── Fetch Market Share from rb_brand_ms (exact user-specified logic) ──
    if (isMarketShare) {
        try {
            // Build the exact query the user specified:
            // SELECT toDate(created_on), Location, SUM(market_share)
            // FROM rb_brand_ms
            // WHERE Platform LIKE '%<platform>%'
            //   AND brand IN (<MS_BRANDS>)
            //   AND Location IN (<MS_LOCATIONS>)
            //   AND date range
            // GROUP BY created_on, Location
            // Then AVG per Location across dates
            const msQueryBase = (sDate, eDate) => `
                SELECT
                    Location,
                    AVG(mars_city_ms) AS avg_market_share
                FROM (
                    SELECT
                        toDate(created_on) AS created_on,
                        Location,
                        SUM(market_share)  AS mars_city_ms
                    FROM rb_brand_ms
                    WHERE ${buildMsConds(sDate, eDate)}
                      AND brand    IN (${MS_BRANDS_SQL})
                      AND Location IN (${MS_LOCATIONS_SQL})
                    GROUP BY created_on, Location
                )
                GROUP BY Location
            `;

            [currMsData, prevMsData] = await Promise.all([
                queryClickHouse(msQueryBase(startDate, endDate)),
                queryClickHouse(msQueryBase(prevStartDate, prevEndDate))
            ]);

            console.log(`[MapIntellect] MS locations: curr=${currMsData.length}, prev=${prevMsData.length}`);
        } catch (e) {
            console.error('[MapIntellect] Error querying rb_brand_ms:', e.message);
        }
    }

    // ── Build lookup maps ──────────────────────────────────────────
    const prevPdpMap = new Map(prevCityData.map(d => [d.Location, d]));
    const currMsMap  = new Map(currMsData.map(d => [(d.Location || '').trim().toLowerCase(), parseFloat(d.avg_market_share || 0)]));
    const prevMsMap  = new Map(prevMsData.map(d => [(d.Location || '').trim().toLowerCase(), parseFloat(d.avg_market_share || 0)]));

    // ── Process and return cities ──────────────────────────────────
    let cities = [];

    if (isMarketShare) {
        // Market Share view — iterate over the 12 rb_brand_ms locations
        cities = currMsData.map(data => {
            const cityName = (data.Location || '').trim();
            const cityKey  = cityName.toLowerCase();
            if (!cityName || cityName.toLowerCase() === 'unknown' || cityName.toLowerCase() === 'other') return null;

            const ms     = parseFloat(data.avg_market_share || 0);
            const prevMs = prevMsMap.get(cityKey) || 0;

            return {
                name: cityName,
                sales: 0, salesFormatted: '₹0', salesChange: 0,
                orders: 0, ordersChange: 0,
                osa: 0, osaChange: 0,
                marketShare: parseFloat(ms.toFixed(1)),
                marketShareChange: parseFloat(calcChange(ms, prevMs).toFixed(1)),
                qty: 0,
            };
        }).filter(Boolean);

    } else {
        // PDP metrics — iterate over ALL rb_pdp_olap locations
        cities = currCityData.map(data => {
            const cityName = (data.Location || '').trim();
            const cityKey  = cityName.toLowerCase();
            if (!cityName || cityName.toLowerCase() === 'unknown' || cityName.toLowerCase() === 'other') return null;

            const prevData = prevPdpMap.get(data.Location) || {};

            const sales   = parseFloat(data.total_sales  || 0);
            const qty     = parseFloat(data.total_qty    || 0);
            const orders  = parseFloat(data.total_orders || 0);
            // city_osa computed directly in SQL: SUM(neno) / NULLIF(SUM(deno), 0) * 100
            const osa     = parseFloat(data.city_osa     || 0);

            const prevSales  = parseFloat(prevData.total_sales  || 0);
            const prevOrders = parseFloat(prevData.total_orders || 0);
            // previous OSA also from SQL
            const prevOsa    = parseFloat(prevData.city_osa     || 0);

            // Enrich with MS value if available for this city
            const ms     = currMsMap.get(cityKey) || 0;
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
                marketShare: parseFloat(ms.toFixed(1)),
                marketShareChange: parseFloat(calcChange(ms, prevMs).toFixed(1)),
                qty: Math.round(qty),
            };
        }).filter(Boolean);
    }

    console.log(`[MapIntellect] Returning ${cities.length} cities for metric: ${metric}`);

    return {
        cities,
        period: {
            startDate: startDate.format('YYYY-MM-DD'),
            endDate:   endDate.format('YYYY-MM-DD'),
        }
    };
};

export default {
    getMapIntellectData,
};
