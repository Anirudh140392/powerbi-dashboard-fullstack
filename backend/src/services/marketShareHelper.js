import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

/**
 * Normalizes multi-value filters from frontend
 * Handles: null, string, comma-separated string, array
 */
export const normalizeFilterArray = (value) => {
    if (!value || value === 'All') return [];
    if (Array.isArray(value)) return value.filter(v => v && v !== 'All');
    if (typeof value === 'string') {
        return value.split(',').map(s => s.trim()).filter(s => s && s !== 'All');
    }
    return [];
};

// ── Category name mapping helpers ──────────────────────────────────────────────
// Maps rb_pdp_olap category names → rb_brand_ms category names + output column
const mapCategoryToMs = (categoryArr) => {
    // col: which column to SELECT from the outer query
    // categoryCond: optional AND clause to filter inner rb_brand_ms by category
    if (!categoryArr || categoryArr.length === 0) {
        return { col: 'combined_ms', categoryCond: '' };
    }
    if (categoryArr.length === 1) {
        const c = categoryArr[0];
        if (c === 'Chocolates' || c === 'Chocolates (Non Gifting)') {
            return { col: 'chocolates_ms', categoryCond: `AND category = 'Chocolates'` };
        }
        if (c === 'Chocolate Gift Pack' || c === 'Chocolates (Gifting)') {
            return { col: 'gift_pack_ms', categoryCond: `AND category = 'Chocolate Gift Pack'` };
        }
        if (c === 'GMFC') {
            return { col: 'gmfc_ms', categoryCond: `AND category = 'GMFC'` };
        }
    }
    // Multiple categories or unrecognised — use combined_ms, no category filter
    return { col: 'combined_ms', categoryCond: '' };
};

/**
 * Shared Market Share Calculation Helper
 * Uses rb_brand_ms table with nation_level_market_share logic.
 * Applies exact user-specified query:
 *   outer: maxIf per category + avg(brand_ms) grouped by created_on, brand
 *   inner: MAX(nation_level_market_share) grouped by created_on, category, brand
 *   final: AVG of the selected column across the date range
 */
export const getMarketShare = async (start, end, platformFilter, categoryFilter, brandFilter = null, locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        const hasLocationFilter = locationArr && locationArr.length > 0 && !locationArr.includes('All');

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (hasLocationFilter) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // If brandFilter is provided, use it. Otherwise use the hardcoded Mars brands.
        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            brandsToQuery = [
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', 'Doublemint'
            ];
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let query;
        if (hasLocationFilter) {
            // Case 2: Location filter active → use market_share column
            // 1) MAX per (dt, platform, loc, cat, brand)
            // 2) SUM per dt
            // 3) AVG over all dt
            query = `
                SELECT AVG(daily_ms) as avg_market_share
                FROM (
                    SELECT dt, SUM(ms_val) as daily_ms
                    FROM (
                        SELECT toDate(created_on) as dt, platform, location, category, brand, MAX(market_share) as ms_val
                        FROM rb_brand_ms
                        WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                        ${platformCond}
                        ${locationCond}
                        ${categoryCond}
                        AND brand IN (${brandsSql})
                        GROUP BY dt, platform, location, category, brand
                    )
                    GROUP BY dt
                )
            `;
        } else {
            // Case 1: No location filter → use nation_level_market_share column
            // 1) MAX per (dt, platform, cat, brand)
            // 2) AVG per (dt, brand)
            // 3) SUM these brand daily averages, then divide by selected days
            const daysCount = end.diff(start, 'day') + 1;
            query = `
                SELECT SUM(brand_daily_avg) / ${daysCount} as avg_market_share
                FROM (
                    SELECT dt, brand, AVG(ms_val) as brand_daily_avg
                    FROM (
                        SELECT toDate(created_on) as dt, platform, category, brand, MAX(nation_level_market_share) as ms_val
                        FROM rb_brand_ms
                        WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                        ${platformCond}
                        ${categoryCond}
                        AND brand IN (${brandsSql})
                        GROUP BY dt, platform, category, brand
                    )
                    GROUP BY dt, brand
                )
            `;
        }
        // console.log(`[MarketShare] hasLocation=${hasLocationFilter}, platform=${platformArr}, category=${categoryArr}, brands=${brandsToQuery.length}`);
        // console.log(`[MarketShare] Query:`, query.substring(0, 200));
        const result = await queryClickHouse(query);
        const val = parseFloat(result?.[0]?.avg_market_share || 0);
        // console.log(`[MarketShare] Result: ${val}, raw:`, JSON.stringify(result?.[0]));
        return val;
    } catch (error) {
        console.error('[MarketShare] Error:', error.message);
        return 0;
    }
};

/**
 * Get Market Share aggregated by month_date
 */
export const getMarketShareByMonth = async (start, end, platformFilter, categoryFilter, brandFilter = null, locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        const hasLocationFilter = locationArr && locationArr.length > 0 && !locationArr.includes('All');

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (hasLocationFilter) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            brandsToQuery = [
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', 'Doublemint'
            ];
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let query;
        if (hasLocationFilter) {
            // Case 2: Location filter active → use market_share column, SUM per month after daily SUM
            query = `
                SELECT formatDateTime(toDate(month_date_val), '%Y-%m-01') as month_date,
                       AVG(daily_ms) as avg_market_share
                FROM (
                    SELECT month_date_val, SUM(ms_val) as daily_ms
                    FROM (
                        SELECT toDate(created_on) as month_date_val, platform, location, category, brand, MAX(market_share) as ms_val
                        FROM rb_brand_ms
                        WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                        ${platformCond}
                        ${locationCond}
                        ${categoryCond}
                        AND brand IN (${brandsSql})
                        GROUP BY month_date_val, platform, location, category, brand
                    )
                    GROUP BY month_date_val
                )
                GROUP BY month_date
            `;
        } else {
            // Case 1: No location filter → use nation_level_market_share column
            // 1) MAX per (dt, platform, cat, brand)
            // 2) AVG per (dt, brand)
            // 3) SUM these brand daily averages, then divide by distinct days in that month
            query = `
                SELECT formatDateTime(toDate(month_date_val), '%Y-%m-01') as month_date,
                       SUM(brand_daily_avg) / count(distinct month_date_val) as avg_market_share
                FROM (
                    SELECT month_date_val, brand, AVG(ms_val) as brand_daily_avg
                    FROM (
                        SELECT toDate(created_on) as month_date_val, platform, category, brand, MAX(nation_level_market_share) as ms_val
                        FROM rb_brand_ms
                        WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                        ${platformCond}
                        ${categoryCond}
                        AND brand IN (${brandsSql})
                        GROUP BY month_date_val, platform, category, brand
                    )
                    GROUP BY month_date_val, brand
                )
                GROUP BY month_date
            `;
        }
        return await queryClickHouse(query);
    } catch (error) {
        console.error('[MarketShareByMonth] Error:', error.message);
        return [];
    }
};

/**
 * Get Market Share aggregated by brand
 */
export const getMarketShareByBrand = async (start, end, platformFilter, categoryFilter, brandFilter = null, locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        const hasLocationFilter = locationArr && locationArr.length > 0 && !locationArr.includes('All');

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (hasLocationFilter) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            brandsToQuery = [
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', 'Doublemint'
            ];
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let query;
        if (hasLocationFilter) {
            // Case 2: Location filter active → use market_share column, SUM grouped by brand
            query = `
                SELECT brand,
                       AVG(daily_ms) as avg_market_share
                FROM (
                    SELECT dt, brand, SUM(ms_val) as daily_ms
                    FROM (
                        SELECT toDate(created_on) as dt, platform, location, category, brand, MAX(market_share) as ms_val
                        FROM rb_brand_ms
                        WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                        ${platformCond}
                        ${locationCond}
                        ${categoryCond}
                        AND brand IN (${brandsSql})
                        GROUP BY dt, platform, location, category, brand
                    )
                    GROUP BY dt, brand
                )
                GROUP BY brand
            `;
        } else {
            // Case 1: No location filter → use nation_level_market_share column
            // 1) MAX per (dt, platform, cat, brand)
            // 2) AVG per (dt, brand)
            // 3) SUM these brand daily averages, then divide by selected days
            const daysCount = end.diff(start, 'day') + 1;
            query = `
                SELECT brand,
                       SUM(brand_daily_avg) / ${daysCount} as avg_market_share
                FROM (
                    SELECT dt, brand, AVG(ms_val) as brand_daily_avg
                    FROM (
                        SELECT toDate(created_on) as dt, platform, category, brand, MAX(nation_level_market_share) as ms_val
                        FROM rb_brand_ms
                        WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                        ${platformCond}
                        ${categoryCond}
                        AND brand IN (${brandsSql})
                        GROUP BY dt, platform, category, brand
                    )
                    GROUP BY dt, brand
                )
                GROUP BY brand
            `;
        }
        const results = await queryClickHouse(query);
        const msMap = new Map();
        results.forEach(r => {
            msMap.set(r.brand.toLowerCase(), parseFloat(r.avg_market_share || 0));
        });
        return msMap;
    } catch (error) {
        console.error('[MarketShareByBrand] Error:', error.message);
        return new Map();
    }
};

/**
 * Get Market Share Time Series aggregated by timeStep
 */
export const getMarketShareTimeSeries = async (start, end, platformFilter, categoryFilter, brandFilter = null, timeStep = 'Daily', locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        const hasLocationFilter = locationArr && locationArr.length > 0 && !locationArr.includes('All');

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (hasLocationFilter) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            brandsToQuery = [
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', 'Doublemint'
            ];
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let groupFormat = '%Y-%m-%d';
        if (timeStep === 'Monthly') groupFormat = '%Y-%m-01';

        let groupExpr = `formatDateTime(dt, '${groupFormat}')`;
        if (timeStep === 'Weekly') groupExpr = `toYearWeek(dt, 1)`;

        let query;
        if (hasLocationFilter) {
            // Case 2: Location filter active → use market_share column, SUM per time bucket after daily SUM
            query = `
                SELECT ${groupExpr} as date_group,
                       AVG(daily_ms) as avg_market_share
                FROM (
                    SELECT dt, SUM(ms_val) as daily_ms
                    FROM (
                        SELECT toDate(created_on) as dt, platform, location, category, brand, MAX(market_share) as ms_val
                        FROM rb_brand_ms
                        WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                        ${platformCond}
                        ${locationCond}
                        ${categoryCond}
                        AND brand IN (${brandsSql})
                        GROUP BY dt, platform, location, category, brand
                    )
                    GROUP BY dt
                )
                GROUP BY date_group
            `;
        } else {
            // Case 1: No location filter → use nation_level_market_share column
            // 1) MAX per (dt, platform, cat, brand)
            // 2) AVG per (dt, brand)
            // 3) SUM these brand daily averages, then divide by distinct days in that bucket
            query = `
                SELECT ${groupExpr} as date_group,
                       SUM(brand_daily_avg) / count(distinct dt) as avg_market_share
                FROM (
                    SELECT dt, brand, AVG(ms_val) as brand_daily_avg
                    FROM (
                        SELECT toDate(created_on) as dt, platform, category, brand, MAX(nation_level_market_share) as ms_val
                        FROM rb_brand_ms
                        WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                        ${platformCond}
                        ${categoryCond}
                        AND brand IN (${brandsSql})
                        GROUP BY dt, platform, category, brand
                    )
                    GROUP BY dt, brand
                )
                GROUP BY date_group
            `;
        }
        const results = await queryClickHouse(query);
        const msMap = new Map();
        results.forEach(r => {
            msMap.set(String(r.date_group), parseFloat(r.avg_market_share || 0));
        });
        return msMap;
    } catch (error) {
        console.error('[MarketShareTimeSeries] Error:', error.message);
        return new Map();
    }
};

/**
 * Get Market Leader Sales
 * Logic: Brand with MAX(SUM(sales)) across the category in the period
 * Returns: { brand, sales, prevSales, delta, deltaAbs }
 */
export const getMarketLeaderSales = async (start, end, platformFilter, categoryFilter, locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');
        const periodDays = end.diff(start, 'day');
        const prevEnd = start.subtract(1, 'day');
        const prevStart = prevEnd.subtract(periodDays, 'day');
        const prevStartStr = prevStart.format('YYYY-MM-DD');
        const prevEndStr = prevEnd.format('YYYY-MM-DD');

        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // Current period: brand with max total sales
        const currentQuery = `
            SELECT brand, SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            AND brand IS NOT NULL AND brand != ''
            GROUP BY brand
            ORDER BY total_sales DESC
            LIMIT 1
        `;

        const currentResult = await queryClickHouse(currentQuery);
        if (!currentResult || currentResult.length === 0) {
            return { brand: 'N/A', sales: 0, prevSales: 0, delta: 0, deltaAbs: 0 };
        }

        const leaderBrand = currentResult[0].brand;
        const leaderSales = parseFloat(currentResult[0].total_sales || 0);

        // Previous period: same brand's sales
        const prevQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            AND brand = '${leaderBrand.replace(/'/g, "''")}'
        `;

        const prevResult = await queryClickHouse(prevQuery);
        const prevSales = parseFloat(prevResult?.[0]?.total_sales || 0);
        const deltaAbs = leaderSales - prevSales;
        const delta = prevSales > 0 ? ((deltaAbs / prevSales) * 100) : 0;

        return {
            brand: leaderBrand,
            sales: leaderSales,
            prevSales,
            delta: parseFloat(delta.toFixed(1)),
            deltaAbs: parseFloat(deltaAbs.toFixed(2))
        };
    } catch (error) {
        console.error('[MarketLeaderSales] Error:', error.message);
        return { brand: 'N/A', sales: 0, prevSales: 0, delta: 0, deltaAbs: 0 };
    }
};

/**
 * Get Mars Wrigley Sales
 * Logic: SUM(sales) WHERE brand is a Mars Wrigley brand
 * Returns: { sales, prevSales, delta, deltaAbs }
 */
export const getMarsWrigleySales = async (start, end, platformFilter, categoryFilter, locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');
        const periodDays = end.diff(start, 'day');
        const prevEnd = start.subtract(1, 'day');
        const prevStart = prevEnd.subtract(periodDays, 'day');
        const prevStartStr = prevStart.format('YYYY-MM-DD');
        const prevEndStr = prevEnd.format('YYYY-MM-DD');

        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // Mars Wrigley brands
        const marsFilter = `AND (
            lower(brand) LIKE '%mars%'
            OR lower(brand) LIKE '%wrigley%'
            OR lower(brand) LIKE '%snickers%'
            OR lower(brand) LIKE '%galaxy%'
            OR lower(brand) LIKE '%bounty%'
            OR lower(brand) LIKE '%twix%'
            OR lower(brand) LIKE '%m&m%'
            OR lower(brand) LIKE '%orbit%'
            OR lower(brand) LIKE '%skittles%'
            OR lower(brand) LIKE '%boomer%'
            OR lower(brand) LIKE '%doublemint%'
            OR lower(brand) LIKE '%pedigree%'
            OR lower(brand) LIKE '%extra%'
        )`;

        // Current period
        const currentQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            ${marsFilter}
        `;

        // Previous period
        const prevQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            ${marsFilter}
        `;

        const [currentResult, prevResult] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery)
        ]);

        const sales = parseFloat(currentResult?.[0]?.total_sales || 0);
        const prevSales = parseFloat(prevResult?.[0]?.total_sales || 0);
        const deltaAbs = sales - prevSales;
        const delta = prevSales > 0 ? ((deltaAbs / prevSales) * 100) : 0;

        return {
            sales,
            prevSales,
            delta: parseFloat(delta.toFixed(1)),
            deltaAbs: parseFloat(deltaAbs.toFixed(2))
        };
    } catch (error) {
        console.error('[MarsWrigleySales] Error:', error.message);
        return { sales: 0, prevSales: 0, delta: 0, deltaAbs: 0 };
    }
};

/**
 * Get Total Category Size
 * Logic: Sum of unique daily_category_size per (date, platform, category)
 */

export const getCategorySize = async (start, end, platformFilter, categoryFilter) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const query = `
            SELECT SUM(daily_size) as total_category_size
            FROM (
                SELECT 
                    toDate(created_on) as d, 
                    platform,
                    category, 
                    any(daily_category_size) as daily_size
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                ${platformCond}
                ${categoryCond}
                GROUP BY d, platform, category
            )
        `;
        const result = await queryClickHouse(query);
        return parseFloat(result?.[0]?.total_category_size || 0);
    } catch (error) {
        console.error('[CategorySize] Error:', error.message);
        return 0;
    }
};

/**
 * Get Sub-Category KPI data
 * Returns: list of sub-categories + brand-level KPIs for a given sub-category
 * KPIs: sub_category_brand_market_share, ASP (mrp), nation_level_market_share
 * Includes delta vs previous period of equal length
 */
export const getSubCategoryKpi = async (start, end, platformFilter, categoryFilter, locationFilter = null, subCategoryFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        // Build shared filter conditions
        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');

        // Calculate previous period (same length, immediately prior)
        const periodDays = end.diff(start, 'day');
        const prevEnd = start.subtract(1, 'day');
        const prevStart = prevEnd.subtract(periodDays, 'day');
        const prevStartStr = prevStart.format('YYYY-MM-DD');
        const prevEndStr = prevEnd.format('YYYY-MM-DD');

        const baseCond = `
            ${platformCond}
            ${locationCond}
            ${categoryCond}
            AND sub_category IS NOT NULL AND sub_category != ''
        `;

        // 1. Get distinct sub-categories
        const subCatQuery = `
            SELECT DISTINCT sub_category
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            ORDER BY sub_category
        `;
        const subCatResults = await queryClickHouse(subCatQuery);
        const subCategories = subCatResults.map(r => r.sub_category).filter(Boolean);

        // Determine which sub-category to fetch brand data for
        const targetSubCat = subCategoryFilter || (subCategories.length > 0 ? subCategories[0] : null);

        if (!targetSubCat) {
            return { subCategories: [], brands: [], selectedSubCategory: null };
        }

        const subCatCond = `AND sub_category = '${targetSubCat.replace(/'/g, "''")}'`;

        // 2. Current period brand KPIs
        const currentQuery = `
            SELECT brand,
                   AVG(toFloat64OrZero(toString(sub_category_brand_market_share))) as market_share,
                   AVG(toFloat64OrZero(toString(mrp))) as asp,
                   AVG(toFloat64OrZero(toString(nation_level_market_share))) as overall_sov,
                   AVG(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            ${subCatCond}
            AND brand IS NOT NULL AND brand != ''
            GROUP BY brand
            ORDER BY market_share DESC
            LIMIT 10
        `;

        // 3. Previous period brand KPIs (for delta)
        const prevQuery = `
            SELECT brand,
                   AVG(toFloat64OrZero(toString(sub_category_brand_market_share))) as market_share,
                   AVG(toFloat64OrZero(toString(mrp))) as asp,
                   AVG(toFloat64OrZero(toString(nation_level_market_share))) as overall_sov,
                   AVG(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            ${subCatCond}
            AND brand IS NOT NULL AND brand != ''
            GROUP BY brand
        `;

        const [currentResults, prevResults] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery)
        ]);

        // Build previous-period lookup
        const prevMap = new Map();
        prevResults.forEach(r => {
            prevMap.set(r.brand, {
                marketShare: parseFloat(r.market_share || 0),
                asp: parseFloat(r.asp || 0),
                overallSov: parseFloat(r.overall_sov || 0),
            });
        });

        // Derive status from delta
        const getStatus = (delta) => {
            if (delta >= 0) return 'Healthy';
            if (delta > -3) return 'Watch';
            return 'Action';
        };

        // 4. Build brands array with deltas
        const brands = currentResults.map(r => {
            const ms = parseFloat(r.market_share || 0);
            const asp = parseFloat(r.asp || 0);
            const sov = parseFloat(r.overall_sov || 0);

            const prev = prevMap.get(r.brand) || { marketShare: 0, asp: 0, overallSov: 0 };
            const msDelta = parseFloat((ms - prev.marketShare).toFixed(1));
            const aspDelta = parseFloat(prev.asp > 0 ? (((asp - prev.asp) / prev.asp) * 100).toFixed(1) : 0);
            const sovDelta = parseFloat((sov - prev.overallSov).toFixed(1));

            return {
                brand: r.brand,
                metrics: {
                    marketShare: { val: parseFloat(ms.toFixed(2)), delta: msDelta, status: getStatus(msDelta) },
                    asp: { val: Math.round(asp), delta: aspDelta, status: getStatus(aspDelta) },
                    overallSov: { val: parseFloat(sov.toFixed(2)), delta: sovDelta, status: getStatus(sovDelta) },
                    paidSov: { val: 0, delta: 0, status: 'Watch' }  // Not available in this table
                }
            };
        });

        return { subCategories, brands, selectedSubCategory: targetSubCat };
    } catch (error) {
        console.error('[SubCategoryKpi] Error:', error.message);
        return { subCategories: [], brands: [], selectedSubCategory: null };
    }
};

/**
 * Get Cross Platform Overview KPIs
 * Returns per-platform data for: categorySize, mwMarketShare, mwSales, mlMarketShare, mlSales
 * Platforms: Blinkit, Instamart, Zepto + ODD Overall (aggregate)
 */
export const getCrossPlatformOverview = async (start, end, platformFilter, categoryFilter, locationFilter = null) => {
    try {
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');
        const periodDays = end.diff(start, 'day');
        const prevEnd = start.subtract(1, 'day');
        const prevStart = prevEnd.subtract(periodDays, 'day');
        const prevStartStr = prevStart.format('YYYY-MM-DD');
        const prevEndStr = prevEnd.format('YYYY-MM-DD');

        const baseCond = `${locationCond} ${categoryCond}`;

        const marsFilter = `(
            lower(brand) LIKE '%mars%'
            OR lower(brand) LIKE '%wrigley%'
            OR lower(brand) LIKE '%snickers%'
            OR lower(brand) LIKE '%galaxy%'
            OR lower(brand) LIKE '%bounty%'
            OR lower(brand) LIKE '%twix%'
            OR lower(brand) LIKE '%m&m%'
            OR lower(brand) LIKE '%orbit%'
            OR lower(brand) LIKE '%skittles%'
            OR lower(brand) LIKE '%boomer%'
            OR lower(brand) LIKE '%doublemint%'
        )`;

        const platforms = ['Blinkit', 'Instamart', 'Zepto'];

        // Build one big query per period that gets all data grouped by platform
        const buildQuery = (s, e) => `
            SELECT
                platform as plat,
                -- Category Size: sum of unique daily_category_size
                SUM(daily_size) as category_size,
                -- MW Market Share: avg nation_level_market_share for Mars brands
                mw_ms,
                -- MW Sales: total sales for Mars brands
                mw_sales,
                -- ML Brand and Sales: brand with max sales
                ml_brand,
                ml_sales,
                -- ML Market Share: nation_level_market_share for ML brand
                ml_ms
            FROM (
                SELECT
                    platform,
                    SUM(daily_size) as daily_size,
                    0 as mw_ms, 0 as mw_sales,
                    '' as ml_brand, 0 as ml_sales, 0 as ml_ms
                FROM (
                    SELECT platform, toDate(created_on) as d, category,
                           any(toFloat64OrZero(toString(daily_category_size))) as daily_size
                    FROM rb_brand_ms
                    WHERE toDate(created_on) BETWEEN '${s}' AND '${e}'
                    ${baseCond}
                    AND platform IS NOT NULL AND platform != ''
                    GROUP BY platform, d, category
                )
                GROUP BY platform
            )
            GROUP BY plat, mw_ms, mw_sales, ml_brand, ml_sales, ml_ms
        `;

        // Simpler approach: run separate targeted queries per metric in parallel
        const buildCatSizeQuery = (s, e) => `
            SELECT platform,
                   SUM(daily_size) as category_size
            FROM (
                SELECT platform, toDate(created_on) as d, category,
                       any(toFloat64OrZero(toString(daily_category_size))) as daily_size
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${s}' AND '${e}'
                ${baseCond}
                AND platform IS NOT NULL AND platform != ''
                GROUP BY platform, d, category
            )
            GROUP BY platform
        `;

        const buildMwQuery = (s, e) => `
            SELECT platform,
                   AVG(toFloat64OrZero(toString(nation_level_market_share))) as mw_market_share,
                   SUM(toFloat64OrZero(toString(sales))) as mw_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${s}' AND '${e}'
            ${baseCond}
            AND ${marsFilter}
            AND platform IS NOT NULL AND platform != ''
            GROUP BY platform
        `;

        const buildMlQuery = (s, e) => `
            SELECT platform, brand,
                   SUM(toFloat64OrZero(toString(sales))) as total_sales,
                   AVG(toFloat64OrZero(toString(nation_level_market_share))) as ml_market_share
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${s}' AND '${e}'
            ${baseCond}
            AND brand IS NOT NULL AND brand != ''
            AND platform IS NOT NULL AND platform != ''
            GROUP BY platform, brand
            ORDER BY platform, total_sales DESC
        `;

        // Fire all 6 queries in parallel (current + prev for each metric)
        const [
            catSizeCurr, catSizePrev,
            mwCurr, mwPrev,
            mlCurr, mlPrev
        ] = await Promise.all([
            queryClickHouse(buildCatSizeQuery(startStr, endStr)),
            queryClickHouse(buildCatSizeQuery(prevStartStr, prevEndStr)),
            queryClickHouse(buildMwQuery(startStr, endStr)),
            queryClickHouse(buildMwQuery(prevStartStr, prevEndStr)),
            queryClickHouse(buildMlQuery(startStr, endStr)),
            queryClickHouse(buildMlQuery(prevStartStr, prevEndStr)),
        ]);

        // Helper to build lookup maps
        const toMap = (rows, keyField = 'platform') => {
            const m = {};
            rows.forEach(r => { m[r[keyField]] = r; });
            return m;
        };

        const catSizeCurrMap = toMap(catSizeCurr);
        const catSizePrevMap = toMap(catSizePrev);
        const mwCurrMap = toMap(mwCurr);
        const mwPrevMap = toMap(mwPrev);

        // For ML, pick top brand per platform
        const mlCurrMap = {};
        const mlPrevMap = {};
        mlCurr.forEach(r => {
            if (!mlCurrMap[r.platform]) mlCurrMap[r.platform] = r; // first = highest sales
        });
        mlPrev.forEach(r => {
            if (!mlPrevMap[r.platform]) mlPrevMap[r.platform] = r;
        });

        const formatCr = (val) => {
            if (val > 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
            if (val > 100000) return `₹ ${(val / 100000).toFixed(2)} L`;
            return `₹ ${val.toFixed(2)}`;
        };

        const calcDelta = (curr, prev) => {
            const deltaAbs = curr - prev;
            const deltaPct = prev > 0 ? ((deltaAbs / prev) * 100) : 0;
            return { deltaPct: parseFloat(deltaPct.toFixed(1)), deltaAbs: parseFloat(deltaAbs.toFixed(2)) };
        };

        const buildPlatformData = (platKey) => {
            const catCurr = parseFloat(catSizeCurrMap[platKey]?.category_size || 0);
            const catPrev = parseFloat(catSizePrevMap[platKey]?.category_size || 0);
            const catDelta = calcDelta(catCurr, catPrev);

            const mwMsCurr = parseFloat(mwCurrMap[platKey]?.mw_market_share || 0);
            const mwMsPrev = parseFloat(mwPrevMap[platKey]?.mw_market_share || 0);
            const mwMsDelta = calcDelta(mwMsCurr, mwMsPrev);

            const mwSalesCurr = parseFloat(mwCurrMap[platKey]?.mw_sales || 0);
            const mwSalesPrev = parseFloat(mwPrevMap[platKey]?.mw_sales || 0);
            const mwSalesDelta = calcDelta(mwSalesCurr, mwSalesPrev);

            const mlRow = mlCurrMap[platKey];
            const mlPrevRow = mlPrevMap[platKey];
            const mlSalesCurr = parseFloat(mlRow?.total_sales || 0);
            const mlSalesPrev = parseFloat(mlPrevRow?.total_sales || 0);
            const mlSalesDelta = calcDelta(mlSalesCurr, mlSalesPrev);
            const mlMsCurr = parseFloat(mlRow?.ml_market_share || 0);
            const mlMsPrev = parseFloat(mlPrevRow?.ml_market_share || 0);
            const mlMsDelta = calcDelta(mlMsCurr, mlMsPrev);

            return {
                categorySize: {
                    raw: catCurr,
                    value: formatCr(catCurr),
                    delta: {
                        value: `${catDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(catDelta.deltaPct)}% (${formatCr(Math.abs(catDelta.deltaAbs))})`,
                        dir: catDelta.deltaPct >= 0 ? 'up' : 'down'
                    }
                },
                mwMarketShare: {
                    raw: mwMsCurr,
                    value: `${mwMsCurr.toFixed(2)}%`,
                    delta: {
                        value: `${mwMsDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(mwMsDelta.deltaPct)}% (${Math.abs(mwMsCurr - mwMsPrev).toFixed(1)}%)`,
                        dir: mwMsDelta.deltaPct >= 0 ? 'up' : 'down'
                    }
                },
                mwSales: {
                    raw: mwSalesCurr,
                    value: formatCr(mwSalesCurr),
                    delta: {
                        value: `${mwSalesDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(mwSalesDelta.deltaPct)}% (${formatCr(Math.abs(mwSalesDelta.deltaAbs))})`,
                        dir: mwSalesDelta.deltaPct >= 0 ? 'up' : 'down'
                    }
                },
                mlMarketShare: {
                    raw: mlMsCurr,
                    value: `${mlMsCurr.toFixed(2)}%`,
                    delta: {
                        value: `${mlMsDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(mlMsDelta.deltaPct)}% (${Math.abs(mlMsCurr - mlMsPrev).toFixed(1)}%)`,
                        dir: mlMsDelta.deltaPct >= 0 ? 'up' : 'down'
                    }
                },
                mlSales: {
                    raw: mlSalesCurr,
                    value: formatCr(mlSalesCurr),
                    delta: {
                        value: `${mlSalesDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(mlSalesDelta.deltaPct)}% (${formatCr(Math.abs(mlSalesDelta.deltaAbs))})`,
                        dir: mlSalesDelta.deltaPct >= 0 ? 'up' : 'down'
                    }
                },
                mlBrand: mlRow?.brand || 'N/A'
            };
        };

        // Build per-platform results
        const result = {};
        platforms.forEach(p => {
            result[p.toLowerCase()] = buildPlatformData(p);
        });

        // ODD Overall = aggregate across all platforms (not just the 3, but all data)
        const allCatCurr = catSizeCurr.reduce((s, r) => s + parseFloat(r.category_size || 0), 0);
        const allCatPrev = catSizePrev.reduce((s, r) => s + parseFloat(r.category_size || 0), 0);
        const allCatDelta = calcDelta(allCatCurr, allCatPrev);

        const allMwMsCurr = mwCurr.length > 0 ? mwCurr.reduce((s, r) => s + parseFloat(r.mw_market_share || 0), 0) / mwCurr.length : 0;
        const allMwMsPrev = mwPrev.length > 0 ? mwPrev.reduce((s, r) => s + parseFloat(r.mw_market_share || 0), 0) / mwPrev.length : 0;
        const allMwMsDelta = calcDelta(allMwMsCurr, allMwMsPrev);

        const allMwSalesCurr = mwCurr.reduce((s, r) => s + parseFloat(r.mw_sales || 0), 0);
        const allMwSalesPrev = mwPrev.reduce((s, r) => s + parseFloat(r.mw_sales || 0), 0);
        const allMwSalesDelta = calcDelta(allMwSalesCurr, allMwSalesPrev);

        // ML overall: brand with highest total sales across all platforms
        const brandSalesMap = {};
        mlCurr.forEach(r => {
            brandSalesMap[r.brand] = (brandSalesMap[r.brand] || 0) + parseFloat(r.total_sales || 0);
        });
        const overallMlBrand = Object.entries(brandSalesMap).sort((a, b) => b[1] - a[1])[0];
        const allMlSalesCurr = overallMlBrand ? overallMlBrand[1] : 0;

        const brandSalesPrevMap = {};
        mlPrev.forEach(r => {
            brandSalesPrevMap[r.brand] = (brandSalesPrevMap[r.brand] || 0) + parseFloat(r.total_sales || 0);
        });
        const allMlSalesPrev = overallMlBrand ? (brandSalesPrevMap[overallMlBrand[0]] || 0) : 0;
        const allMlSalesDelta = calcDelta(allMlSalesCurr, allMlSalesPrev);

        // ML market share overall: average across platforms for ML brand
        const mlMsBrandRows = mlCurr.filter(r => overallMlBrand && r.brand === overallMlBrand[0]);
        const allMlMsCurr = mlMsBrandRows.length > 0 ? mlMsBrandRows.reduce((s, r) => s + parseFloat(r.ml_market_share || 0), 0) / mlMsBrandRows.length : 0;
        const mlMsBrandPrevRows = mlPrev.filter(r => overallMlBrand && r.brand === overallMlBrand[0]);
        const allMlMsPrev = mlMsBrandPrevRows.length > 0 ? mlMsBrandPrevRows.reduce((s, r) => s + parseFloat(r.ml_market_share || 0), 0) / mlMsBrandPrevRows.length : 0;
        const allMlMsDelta = calcDelta(allMlMsCurr, allMlMsPrev);

        result['odd_overall'] = {
            categorySize: {
                raw: allCatCurr,
                value: formatCr(allCatCurr),
                delta: { value: `${allCatDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allCatDelta.deltaPct)}% (${formatCr(Math.abs(allCatDelta.deltaAbs))})`, dir: allCatDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mwMarketShare: {
                raw: allMwMsCurr,
                value: `${allMwMsCurr.toFixed(2)}%`,
                delta: { value: `${allMwMsDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allMwMsDelta.deltaPct)}% (${Math.abs(allMwMsCurr - allMwMsPrev).toFixed(1)} %)`, dir: allMwMsDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mwSales: {
                raw: allMwSalesCurr,
                value: formatCr(allMwSalesCurr),
                delta: { value: `${allMwSalesDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allMwSalesDelta.deltaPct)}% (${formatCr(Math.abs(allMwSalesDelta.deltaAbs))})`, dir: allMwSalesDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mlMarketShare: {
                raw: allMlMsCurr,
                value: `${allMlMsCurr.toFixed(2)}%`,
                delta: { value: `${allMlMsDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allMlMsDelta.deltaPct)}% (${Math.abs(allMlMsCurr - allMlMsPrev).toFixed(1)} %)`, dir: allMlMsDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mlSales: {
                raw: allMlSalesCurr,
                value: formatCr(allMlSalesCurr),
                delta: { value: `${allMlSalesDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allMlSalesDelta.deltaPct)}% (${formatCr(Math.abs(allMlSalesDelta.deltaAbs))})`, dir: allMlSalesDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mlBrand: overallMlBrand ? overallMlBrand[0] : 'N/A'
        };

        return result;
    } catch (error) {
        console.error('[CrossPlatformOverview] Error:', error.message);
        return {};
    }
};

/**
 * Get Market Share Trends
 * Returns time series data for market share metrics.
 */
export const getMarketShareTrends = async (period, timeStep, dimension, dimensionValue, startDate, endDate, platformFilter, categoryFilter, locationFilter, brandFilter) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);
        const brandArr = normalizeFilterArray(brandFilter);

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All') && !locationArr.includes('All India')) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            platformCond = `AND platform IN (${platformArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandCond = '';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandCond = `AND brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // Calculate Date Range based on period if Custom is not provided
        let startRaw = dayjs().subtract(30, 'day');
        let endRaw = dayjs();

        if (period === 'Custom' && startDate && endDate) {
            startRaw = dayjs(startDate);
            endRaw = dayjs(endDate);
        } else {
            switch (period) {
                case '1M': startRaw = dayjs().subtract(1, 'month'); break;
                case '3M': startRaw = dayjs().subtract(3, 'months'); break;
                case '6M': startRaw = dayjs().subtract(6, 'months'); break;
                case '1Y': startRaw = dayjs().subtract(1, 'year'); break;
                default: startRaw = dayjs().subtract(30, 'days'); break;
            }
        }

        const startStr = startRaw.format('YYYY-MM-DD');
        const endStr = endRaw.format('YYYY-MM-DD');

        // Grouping logic based on timeStep
        let dateGroupPart = '';
        let dateFormatStr = '';
        switch (timeStep) {
            case 'Weekly':
                dateGroupPart = `toStartOfWeek(toDate(created_on))`;
                dateFormatStr = 'DD MMM YYYY'; // Start of week date
                break;
            case 'Monthly':
                dateGroupPart = `toStartOfMonth(toDate(created_on))`;
                dateFormatStr = 'MMM YYYY';
                break;
            case 'Daily':
            default:
                dateGroupPart = `toDate(created_on)`;
                dateFormatStr = 'DD MMM YYYY';
                break;
        }

        const baseCond = `${locationCond} ${categoryCond} ${platformCond} ${brandCond}`;

        const marsFilter = `(
            lower(brand) LIKE '%mars%'
            OR lower(brand) LIKE '%wrigley%'
            OR lower(brand) LIKE '%snickers%'
            OR lower(brand) LIKE '%galaxy%'
            OR lower(brand) LIKE '%bounty%'
            OR lower(brand) LIKE '%twix%'
            OR lower(brand) LIKE '%m&m%'
            OR lower(brand) LIKE '%orbit%'
            OR lower(brand) LIKE '%skittles%'
            OR lower(brand) LIKE '%boomer%'
            OR lower(brand) LIKE '%doublemint%'
        )`;

        // Query 1: Category Size per period
        const catSizeQuery = `
            SELECT
                ${dateGroupPart} as d,
                SUM(daily_size) as category_size
            FROM (
                SELECT ${dateGroupPart} as d, platform, category,
                       any(toFloat64OrZero(toString(daily_category_size))) as daily_size
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
                ${baseCond}
                GROUP BY d, platform, category
            )
            GROUP BY d
            ORDER BY d ASC
        `;

        // Query 2: MW Sales & Market Share per period
        const mwQuery = `
            SELECT
                ${dateGroupPart} as d,
                SUM(toFloat64OrZero(toString(sales))) as mw_sales,
                AVG(toFloat64OrZero(toString(nation_level_market_share))) as mw_ms
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            AND ${marsFilter}
            GROUP BY d
            ORDER BY d ASC
        `;

        // Query 3: Market Leader Sales & Share per period.
        // For each period, we find the brand with the highest overall sales.
        const mlQuery = `
            SELECT
                d,
                brand as ml_brand,
                total_sales as ml_sales,
                avg_ms as ml_ms
            FROM (
                SELECT
                    d,
                    brand,
                    SUM(toFloat64OrZero(toString(sales))) as total_sales,
                    AVG(toFloat64OrZero(toString(nation_level_market_share))) as avg_ms
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
                ${baseCond}
                AND brand IS NOT NULL AND brand != ''
                GROUP BY d, brand
            )
            ORDER BY d ASC, ml_sales DESC
        `;

        const [catData, mwData, mlDataRaw] = await Promise.all([
            queryClickHouse(catSizeQuery),
            queryClickHouse(mwQuery),
            queryClickHouse(mlQuery)
        ]);

        // ML data has all brands sorted by sales descending, pick first per date
        const topMlByDate = {};
        mlDataRaw.forEach(row => {
            const dateStr = dayjs(row.d).format('YYYY-MM-DD');
            if (!topMlByDate[dateStr]) {
                topMlByDate[dateStr] = row;
            }
        });

        // Merge results keyed by date
        const timeSeriesMap = new Map();

        // Helper to get or init
        const getRow = (dRaw) => {
            let key = '';
            // Handle returned ClickHouse date parsing appropriately
            try {
                if (typeof dRaw === 'string') {
                    // Check if it's already a clean date string or full datetime
                    key = dayjs(dRaw.split('T')[0]).format('YYYY-MM-DD');
                } else if (dRaw instanceof Date) {
                    key = dayjs(dRaw).format('YYYY-MM-DD');
                }
            } catch (e) { key = dRaw; }

            const displayDate = dayjs(key).format(dateFormatStr);

            if (!timeSeriesMap.has(key)) {
                timeSeriesMap.set(key, {
                    dateStr: key,
                    date: displayDate,
                    CategorySize: 0,
                    MWMarketShare: 0,
                    MWSales: 0,
                    MLMarketShare: 0,
                    MLSales: 0
                });
            }
            return timeSeriesMap.get(key);
        };

        // Populate cat data
        catData.forEach(r => {
            const row = getRow(r.d);
            row.CategorySize = parseFloat((parseFloat(r.category_size) / 10000000).toFixed(2)); // in Cr
        });

        // Populate MW data
        mwData.forEach(r => {
            const row = getRow(r.d);
            row.MWMarketShare = parseFloat(parseFloat(r.mw_ms).toFixed(2));
            row.MWSales = parseFloat((parseFloat(r.mw_sales) / 10000000).toFixed(2)); // in Cr
        });

        // Populate ML data
        Object.entries(topMlByDate).forEach(([dateStr, r]) => {
            const row = getRow(dateStr);
            row.MLMarketShare = parseFloat(parseFloat(r.ml_ms).toFixed(2));
            row.MLSales = parseFloat((parseFloat(r.ml_sales) / 10000000).toFixed(2)); // in Cr
        });

        // Convert to sorted array
        const timeSeries = Array.from(timeSeriesMap.values()).sort((a, b) => dayjs(a.dateStr).diff(dayjs(b.dateStr)));
        // Remove helper dateStr field
        timeSeries.forEach(r => delete r.dateStr);

        return { timeSeries };
    } catch (error) {
        console.error('[MarketShareTrends] Error:', error);
        return { timeSeries: [] };
    }
};

/**
 * Get Market Share Competition (Brand level)
 * Returns generic brand-level KPIs (marketShare, sales) for the top brands.
 */
export const getMarketShareCompetition = async (period, startDate, endDate, platformFilter, categoryFilter, locationFilter, brandFilter) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);
        const brandArr = normalizeFilterArray(brandFilter);

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All') && !locationArr.includes('All India')) {
            locationCond = `AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = categoryArr.map(c => {
                if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                return c;
            });
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            platformCond = `AND platform IN (${platformArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandCond = '';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandCond = `AND brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let startRaw = dayjs().subtract(30, 'day');
        let endRaw = dayjs();

        if (period === 'Custom' && startDate && endDate) {
            startRaw = dayjs(startDate);
            endRaw = dayjs(endDate);
        } else {
            switch (period) {
                case '1M': startRaw = dayjs().subtract(1, 'month'); break;
                case '3M': startRaw = dayjs().subtract(3, 'months'); break;
                case '6M': startRaw = dayjs().subtract(6, 'months'); break;
                case '1Y': startRaw = dayjs().subtract(1, 'year'); break;
                default: startRaw = dayjs().subtract(30, 'days'); break;
            }
        }

        const startStr = startRaw.format('YYYY-MM-DD');
        const endStr = endRaw.format('YYYY-MM-DD');

        const periodDays = endRaw.diff(startRaw, 'day');
        const prevEnd = startRaw.subtract(1, 'day');
        const prevStart = prevEnd.subtract(periodDays, 'day');
        const prevStartStr = prevStart.format('YYYY-MM-DD');
        const prevEndStr = prevEnd.format('YYYY-MM-DD');

        const baseCond = `${locationCond} ${categoryCond} ${platformCond} ${brandCond}`;

        // Get current period data
        const currentQuery = `
            SELECT 
                brand as brand_name,
                AVG(toFloat64OrZero(toString(nation_level_market_share))) as market_share,
                SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            GROUP BY brand
            ORDER BY market_share DESC
        `;

        // Get previous period data
        const prevQuery = `
            SELECT 
                brand as brand_name,
                AVG(toFloat64OrZero(toString(nation_level_market_share))) as market_share,
                SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            GROUP BY brand
        `;

        // Also get Category size for the current period (so we can return it as an extra KPI)
        const catSizeQuery = `
            SELECT SUM(daily_size) as total_category_size
            FROM (
                SELECT 
                    toDate(created_on) as d, 
                    platform,
                    category, 
                    any(toFloat64OrZero(toString(daily_category_size))) as daily_size
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
                ${baseCond}
                GROUP BY d, platform, category
            )
        `;

        // Get current period sku data
        const currentSkuQuery = `
            SELECT 
                item_name as sku_name,
                brand as brand_name,
                AVG(toFloat64OrZero(toString(nation_level_market_share))) as market_share,
                SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            AND item_name IS NOT NULL AND item_name != ''
            GROUP BY item_name, brand
            ORDER BY market_share DESC
        `;

        const prevSkuQuery = `
            SELECT 
                item_name as sku_name,
                AVG(toFloat64OrZero(toString(nation_level_market_share))) as market_share,
                SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            AND item_name IS NOT NULL AND item_name != ''
            GROUP BY item_name
        `;

        const [currRows, prevRows, catResult, currSkuRows, prevSkuRows] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery),
            queryClickHouse(catSizeQuery),
            queryClickHouse(currentSkuQuery),
            queryClickHouse(prevSkuQuery)
        ]);

        const totalCatSize = catResult?.[0]?.total_category_size || 0;

        const prevMap = {};
        prevRows.forEach(row => {
            prevMap[row.brand_name] = row;
        });

        // Format raw value (to Cr if needed, but sales and cat size should be raw, frontend handles formatting if needed - wait, frontend uses raw numerical value)
        const formatNumeric = val => parseFloat(Number(val || 0).toFixed(2));

        const brands = currRows.map(curr => {
            const prev = prevMap[curr.brand_name] || { market_share: 0, total_sales: 0 };

            const msCurr = formatNumeric(curr.market_share);
            const msPrev = formatNumeric(prev.market_share);
            const salesCurrFn = formatNumeric(curr.total_sales / 10000000); // Send in Cr like others
            const salesPrevFn = formatNumeric(prev.total_sales / 10000000);

            return {
                brand_name: curr.brand_name,
                MarketShare: {
                    value: msCurr,
                    delta: formatNumeric(msCurr - msPrev)
                },
                Sales: {
                    value: salesCurrFn,
                    delta: formatNumeric(salesCurrFn - salesPrevFn)
                },
                CategorySize: {
                    value: formatNumeric(totalCatSize / 10000000), // In Cr
                    delta: 0
                }
            };
        });

        const prevSkuMap = {};
        prevSkuRows.forEach(row => {
            prevSkuMap[row.sku_name] = row;
        });

        const skus = currSkuRows.map(curr => {
            const prev = prevSkuMap[curr.sku_name] || { market_share: 0, total_sales: 0 };

            const msCurr = formatNumeric(curr.market_share);
            const msPrev = formatNumeric(prev.market_share);
            const salesCurrFn = formatNumeric(curr.total_sales / 10000000); // Send in Cr like others
            const salesPrevFn = formatNumeric(prev.total_sales / 10000000);

            return {
                sku_name: curr.sku_name,
                brand_name: curr.brand_name,
                MarketShare: {
                    value: msCurr,
                    delta: formatNumeric(msCurr - msPrev)
                },
                Sales: {
                    value: salesCurrFn,
                    delta: formatNumeric(salesCurrFn - salesPrevFn)
                },
                CategorySize: {
                    value: formatNumeric(totalCatSize / 10000000), // In Cr
                    delta: 0
                }
            };
        });

        return { brands, skus };
    } catch (error) {
        console.error('[MarketShareCompetition] Error:', error.message);
        return { brands: [], skus: [] };
    }
};

/**
 * Get Market Share Filter Options (Cascading)
 */
export const getMarketShareCompetitionFilterOptions = async (platformFilter, locationFilter, categoryFilter, brandFilter) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const locationArr = normalizeFilterArray(locationFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);

        let baseCond = "1=1";

        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            baseCond += ` AND platform IN (${platformArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`;
        }

        if (locationArr && locationArr.length > 0 && !locationArr.includes('All') && !locationArr.includes('All India')) {
            baseCond += ` AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // Categories: Independent of other lower-level filters
        const categoryQuery = `
            SELECT DISTINCT category 
            FROM rb_brand_ms 
            WHERE ${baseCond} AND category IS NOT NULL AND category != ''
            ORDER BY category
        `;

        // Brands: Filtered by Selection + Categories
        let brandCond = baseCond;
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            brandCond += ` AND category IN (${categoryArr.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }
        const brandQuery = `
            SELECT DISTINCT brand 
            FROM rb_brand_ms 
            WHERE ${brandCond} AND brand IS NOT NULL AND brand != ''
            ORDER BY brand
        `;

        // SKUs: Filtered by Selection + Categories + Brands
        let skuCond = brandCond;
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            skuCond += ` AND brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`;
        }
        const skuQuery = `
            SELECT DISTINCT item_name as sku_name 
            FROM rb_brand_ms 
            WHERE ${skuCond} AND item_name IS NOT NULL AND item_name != ''
            ORDER BY item_name
        `;

        const [catResults, brandResults, skuResults] = await Promise.all([
            queryClickHouse(categoryQuery),
            queryClickHouse(brandQuery),
            queryClickHouse(skuQuery)
        ]);

        return {
            categories: catResults.map(r => r.category),
            brands: brandResults.map(r => r.brand),
            skus: skuResults.map(r => r.sku_name)
        };
    } catch (error) {
        console.error('[MarketShareFilterOptions] Error:', error.message);
        return { categories: [], brands: [], skus: [] };
    }
};

/**
 * Get Market Share Competition Trends (Time Series)
 */
export const getMarketShareCompetitionTrends = async (mode, targets, period, startDate, endDate, platform, category, location) => {
    try {
        const targetArr = normalizeFilterArray(targets);
        const platformArr = normalizeFilterArray(platform);
        const categoryArr = normalizeFilterArray(category);
        const locationArr = normalizeFilterArray(location);

        let baseCond = "1=1";
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            baseCond += ` AND platform IN (${platformArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`;
        }
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            baseCond += ` AND category IN (${categoryArr.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All') && !locationArr.includes('All India')) {
            baseCond += ` AND location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let startRaw = dayjs().subtract(30, 'day');
        let endRaw = dayjs();
        if (period === 'Custom' && startDate && endDate) {
            startRaw = dayjs(startDate);
            endRaw = dayjs(endDate);
        } else {
            switch (period) {
                case '1M': startRaw = dayjs().subtract(1, 'month'); break;
                case '3M': startRaw = dayjs().subtract(3, 'months'); break;
                case '6M': startRaw = dayjs().subtract(6, 'months'); break;
                case '1Y': startRaw = dayjs().subtract(1, 'year'); break;
                default: startRaw = dayjs().subtract(30, 'days'); break;
            }
        }
        const startStr = startRaw.format('YYYY-MM-DD');
        const endStr = endRaw.format('YYYY-MM-DD');

        const targetCol = mode === 'brand' ? 'brand' : 'item_name';
        let targetCond = "";
        if (targetArr && targetArr.length > 0 && !targetArr.includes('All')) {
            targetCond = ` AND ${targetCol} IN (${targetArr.map(t => `'${t.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // Query 1: Time series for each target
        const trendQuery = `
            SELECT
                toDate(\`created_on\`) as d,
                \`${targetCol}\` as target,
                AVG(CAST(\`nation_level_market_share\` AS Float64)) as ms,
                SUM(CAST(\`sales\` AS Float64)) as sales
            FROM rb_brand_ms
            WHERE toDate(\`created_on\`) >= '${startStr}' AND toDate(\`created_on\`) <= '${endStr}'
            AND ${baseCond}
            ${targetCond}
            GROUP BY d, target
            ORDER BY d ASC
        `;

        // Query 2: Category size time series (independent of targets)
        const catSizeQuery = `
            SELECT
                d,
                SUM(daily_size) as category_size
            FROM (
                SELECT toDate(\`created_on\`) as d, platform, category,
                       any(CAST(\`daily_category_size\` AS Float64)) as daily_size
                FROM rb_brand_ms
                WHERE toDate(\`created_on\`) >= '${startStr}' AND toDate(\`created_on\`) <= '${endStr}'
                AND ${baseCond}
                GROUP BY d, platform, category
            )
            GROUP BY d
            ORDER BY d ASC
        `;

        console.log('[MarketShareHelper] trendQuery:', trendQuery);
        console.log('[MarketShareHelper] catSizeQuery:', catSizeQuery);

        const [trendResult, catResult] = await Promise.all([
            queryClickHouse(trendQuery),
            queryClickHouse(catSizeQuery)
        ]);

        const catMap = {};
        catResult.forEach(row => {
            catMap[dayjs(row.d).format('YYYY-MM-DD')] = row.category_size;
        });

        const tsByTarget = {};
        const datesSet = new Set();
        const formatNumeric = val => parseFloat(Number(val || 0).toFixed(2));

        trendResult.forEach(row => {
            const dateStr = dayjs(row.d).format('YYYY-MM-DD');
            const target = row.target;
            datesSet.add(dateStr);

            if (!tsByTarget[target]) tsByTarget[target] = {};

            tsByTarget[target][dateStr] = {
                MarketShare: formatNumeric(row.ms),
                Sales: formatNumeric(row.sales / 10000000), // In Cr
                CategorySize: formatNumeric((catMap[dateStr] || 0) / 10000000) // In Cr
            };
        });

        return {
            dates: Array.from(datesSet).sort(),
            timeSeriesByTarget: tsByTarget
        };
    } catch (error) {
        console.error('[MarketShareCompetitionTrends] Error:', error.message);
        return { dates: [], timeSeriesByTarget: {} };
    }
};

