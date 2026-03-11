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
// Maps rb_pdp_olap category names → rb_ms_olap category names
const mapCategoryForMs = (categoryArr) => {
    if (!categoryArr || categoryArr.length === 0) return [];
    return categoryArr.map(c => {
        if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
        if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
        return c;
    });
};

/**
 * Shared Market Share Calculation Helper
 * Uses rb_ms_olap table with sales-based formula:
 *   Market Share = SUM(our_sales) / SUM(total_category_sales) * 100
 * The denominator is always the total sales for the category(ies) the selected entity belongs to.
 */
export const getMarketShare = async (start, end, platformFilter, categoryFilter, brandFilter = null, locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);
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

        // Brands to query (our brands)
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
        const mappedCats = mapCategoryForMs(categoryArr);
        if (mappedCats.length > 0) {
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const dateFilter = `toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`;
        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // Numerator: SUM(sales) for our brands
        const numQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as our_sales
            FROM rb_ms_olap
            WHERE ${dateFilter}
            ${baseCond}
            AND group_brand IN (${brandsSql})
        `;

        // Denominator: SUM(sales) for all brands in the same categories (= category size)
        const denomQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE ${dateFilter}
            ${baseCond}
        `;

        const [numResult, denomResult] = await Promise.all([
            queryClickHouse(numQuery),
            queryClickHouse(denomQuery)
        ]);

        const ourSales = parseFloat(numResult?.[0]?.our_sales || 0);
        const totalSales = parseFloat(denomResult?.[0]?.total_sales || 0);
        const ms = totalSales > 0 ? (ourSales / totalSales) * 100 : 0;
        return parseFloat(ms.toFixed(2));
    } catch (error) {
        console.error('[MarketShare] Error:', error.message);
        return 0;
    }
};

/**
 * Get Market Share aggregated by month_date
 * Uses rb_ms_olap: SUM(our_sales) / SUM(total_sales) * 100 per month
 */
export const getMarketShareByMonth = async (start, end, platformFilter, categoryFilter, brandFilter = null, locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);
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
        const mappedCats = mapCategoryForMs(categoryArr);
        if (mappedCats.length > 0) {
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const dateFilter = `toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`;
        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // Numerator per month
        const numQuery = `
            SELECT formatDateTime(toDate(created_on), '%Y-%m-01') as month_date,
                   SUM(toFloat64OrZero(toString(sales))) as our_sales
            FROM rb_ms_olap
            WHERE ${dateFilter}
            ${baseCond}
            AND group_brand IN (${brandsSql})
            GROUP BY month_date
            ORDER BY month_date
        `;

        // Denominator per month (category size)
        const denomQuery = `
            SELECT formatDateTime(toDate(created_on), '%Y-%m-01') as month_date,
                   SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE ${dateFilter}
            ${baseCond}
            GROUP BY month_date
            ORDER BY month_date
        `;

        const [numResults, denomResults] = await Promise.all([
            queryClickHouse(numQuery),
            queryClickHouse(denomQuery)
        ]);

        const denomMap = {};
        denomResults.forEach(r => { denomMap[r.month_date] = parseFloat(r.total_sales || 0); });

        return numResults.map(r => {
            const ourSales = parseFloat(r.our_sales || 0);
            const totalSales = denomMap[r.month_date] || 0;
            const ms = totalSales > 0 ? (ourSales / totalSales) * 100 : 0;
            return { month_date: r.month_date, avg_market_share: parseFloat(ms.toFixed(2)) };
        });
    } catch (error) {
        console.error('[MarketShareByMonth] Error:', error.message);
        return [];
    }
};

/**
 * Get Market Share aggregated by brand
 * Uses rb_ms_olap: SUM(brand_sales) / SUM(total_sales) * 100 per brand
 */
export const getMarketShareByBrand = async (start, end, platformFilter, categoryFilter, brandFilter = null, locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);
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
        const mappedCats = mapCategoryForMs(categoryArr);
        if (mappedCats.length > 0) {
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const dateFilter = `toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`;
        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // Per-brand sales
        const numQuery = `
            SELECT group_brand as brand,
                   SUM(toFloat64OrZero(toString(sales))) as brand_sales
            FROM rb_ms_olap
            WHERE ${dateFilter}
            ${baseCond}
            AND group_brand IN (${brandsSql})
            GROUP BY group_brand
        `;

        // Total category sales (denominator)
        const denomQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE ${dateFilter}
            ${baseCond}
        `;

        const [numResults, denomResult] = await Promise.all([
            queryClickHouse(numQuery),
            queryClickHouse(denomQuery)
        ]);

        const totalSales = parseFloat(denomResult?.[0]?.total_sales || 0);
        const msMap = new Map();
        numResults.forEach(r => {
            const brandSales = parseFloat(r.brand_sales || 0);
            const ms = totalSales > 0 ? (brandSales / totalSales) * 100 : 0;
            msMap.set(r.brand.toLowerCase(), parseFloat(ms.toFixed(2)));
        });
        return msMap;
    } catch (error) {
        console.error('[MarketShareByBrand] Error:', error.message);
        return new Map();
    }
};

/**
 * Get Market Share Time Series aggregated by timeStep
 * Uses rb_ms_olap: SUM(our_sales) / SUM(total_sales) * 100 per time bucket
 */
export const getMarketShareTimeSeries = async (start, end, platformFilter, categoryFilter, brandFilter = null, timeStep = 'Daily', locationFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const brandArr = normalizeFilterArray(brandFilter);
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
        const mappedCats = mapCategoryForMs(categoryArr);
        if (mappedCats.length > 0) {
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let groupExpr;
        if (timeStep === 'Monthly') groupExpr = `formatDateTime(toDate(created_on), '%Y-%m-01')`;
        else if (timeStep === 'Weekly') groupExpr = `toYearWeek(toDate(created_on), 1)`;
        else groupExpr = `formatDateTime(toDate(created_on), '%Y-%m-%d')`;

        const dateFilter = `toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`;
        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // Numerator per time bucket
        const numQuery = `
            SELECT ${groupExpr} as date_group,
                   SUM(toFloat64OrZero(toString(sales))) as our_sales
            FROM rb_ms_olap
            WHERE ${dateFilter}
            ${baseCond}
            AND group_brand IN (${brandsSql})
            GROUP BY date_group
            ORDER BY date_group
        `;

        // Denominator per time bucket (category size)
        const denomQuery = `
            SELECT ${groupExpr} as date_group,
                   SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE ${dateFilter}
            ${baseCond}
            GROUP BY date_group
            ORDER BY date_group
        `;

        const [numResults, denomResults] = await Promise.all([
            queryClickHouse(numQuery),
            queryClickHouse(denomQuery)
        ]);

        const denomMap = {};
        denomResults.forEach(r => { denomMap[String(r.date_group)] = parseFloat(r.total_sales || 0); });

        const msMap = new Map();
        numResults.forEach(r => {
            const key = String(r.date_group);
            const ourSales = parseFloat(r.our_sales || 0);
            const totalSales = denomMap[key] || 0;
            const ms = totalSales > 0 ? (ourSales / totalSales) * 100 : 0;
            msMap.set(key, parseFloat(ms.toFixed(2)));
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
            SELECT group_brand as brand, SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            AND group_brand IS NOT NULL AND group_brand != ''
            GROUP BY group_brand
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
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            AND group_brand = '${leaderBrand.replace(/'/g, "''")}'
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
            lower(group_brand) LIKE '%mars%'
            OR lower(group_brand) LIKE '%wrigley%'
            OR lower(group_brand) LIKE '%snickers%'
            OR lower(group_brand) LIKE '%galaxy%'
            OR lower(group_brand) LIKE '%bounty%'
            OR lower(group_brand) LIKE '%twix%'
            OR lower(group_brand) LIKE '%m&m%'
            OR lower(group_brand) LIKE '%orbit%'
            OR lower(group_brand) LIKE '%skittles%'
            OR lower(group_brand) LIKE '%boomer%'
            OR lower(group_brand) LIKE '%doublemint%'
            OR lower(group_brand) LIKE '%pedigree%'
            OR lower(group_brand) LIKE '%extra%'
        )`;

        // Current period
        const currentQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            ${marsFilter}
        `;

        // Previous period
        const prevQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
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
 * Logic: SUM of all sales in rb_ms_olap for the selected category/platform/date range
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
        const mappedCats = mapCategoryForMs(categoryArr);
        if (mappedCats.length > 0) {
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const query = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_category_size
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
            ${platformCond}
            ${categoryCond}
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
 * Returns: list of categories + brand-level KPIs for a given category
 * KPIs: market_share (sales-based), total_sales
 * Includes delta vs previous period of equal length
 * NOTE: rb_ms_olap does not have sub_category, so we use category instead
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
            const mappedCats = mapCategoryForMs(categoryArr);
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
            AND category IS NOT NULL AND category != ''
        `;

        // 1. Get distinct categories (as sub-categories)
        const subCatQuery = `
            SELECT DISTINCT category as sub_category
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            ORDER BY category
        `;
        const subCatResults = await queryClickHouse(subCatQuery);
        const subCategories = subCatResults.map(r => r.sub_category).filter(Boolean);

        // Determine which category to fetch brand data for
        const targetSubCat = subCategoryFilter || (subCategories.length > 0 ? subCategories[0] : null);

        if (!targetSubCat) {
            return { subCategories: [], brands: [], selectedSubCategory: null };
        }

        const subCatCond = `AND category = '${targetSubCat.replace(/'/g, "''")}'`;

        // Get total category sales for denominator
        const totalSalesQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${platformCond} ${locationCond}
            ${subCatCond}
        `;

        const prevTotalSalesQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${platformCond} ${locationCond}
            ${subCatCond}
        `;

        // 2. Current period brand KPIs
        const currentQuery = `
            SELECT group_brand as brand,
                   SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            ${subCatCond}
            AND group_brand IS NOT NULL AND group_brand != ''
            GROUP BY group_brand
            ORDER BY total_sales DESC
            LIMIT 10
        `;

        // 3. Previous period brand KPIs (for delta)
        const prevQuery = `
            SELECT group_brand as brand,
                   SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            ${subCatCond}
            AND group_brand IS NOT NULL AND group_brand != ''
            GROUP BY group_brand
        `;

        const [currentResults, prevResults, totalSalesResult, prevTotalSalesResult] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery),
            queryClickHouse(totalSalesQuery),
            queryClickHouse(prevTotalSalesQuery)
        ]);

        const totalCatSales = parseFloat(totalSalesResult?.[0]?.total_sales || 0);
        const prevTotalCatSales = parseFloat(prevTotalSalesResult?.[0]?.total_sales || 0);

        // Build previous-period lookup
        const prevMap = new Map();
        prevResults.forEach(r => {
            const ms = prevTotalCatSales > 0 ? (parseFloat(r.total_sales || 0) / prevTotalCatSales) * 100 : 0;
            prevMap.set(r.brand, { marketShare: ms });
        });

        // Derive status from delta
        const getStatus = (delta) => {
            if (delta >= 0) return 'Healthy';
            if (delta > -3) return 'Watch';
            return 'Action';
        };

        // 4. Build brands array with deltas
        const brands = currentResults.map(r => {
            const brandSales = parseFloat(r.total_sales || 0);
            const ms = totalCatSales > 0 ? (brandSales / totalCatSales) * 100 : 0;

            const prev = prevMap.get(r.brand) || { marketShare: 0 };
            const msDelta = parseFloat((ms - prev.marketShare).toFixed(1));

            return {
                brand: r.brand,
                metrics: {
                    marketShare: { val: parseFloat(ms.toFixed(2)), delta: msDelta, status: getStatus(msDelta) },
                    asp: { val: 0, delta: 0, status: 'Watch' }, // Not available in rb_ms_olap
                    overallSov: { val: 0, delta: 0, status: 'Watch' }, // Not available in rb_ms_olap
                    paidSov: { val: 0, delta: 0, status: 'Watch' }
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
            lower(group_brand) LIKE '%mars%'
            OR lower(group_brand) LIKE '%wrigley%'
            OR lower(group_brand) LIKE '%snickers%'
            OR lower(group_brand) LIKE '%galaxy%'
            OR lower(group_brand) LIKE '%bounty%'
            OR lower(group_brand) LIKE '%twix%'
            OR lower(group_brand) LIKE '%m&m%'
            OR lower(group_brand) LIKE '%orbit%'
            OR lower(group_brand) LIKE '%skittles%'
            OR lower(group_brand) LIKE '%boomer%'
            OR lower(group_brand) LIKE '%doublemint%'
        )`;

        const platforms = ['Blinkit', 'Instamart', 'Zepto'];

        // Build one big query per period that gets all data grouped by platform
        // (kept for reference but not used - we use separate queries below)
        const buildQuery = (s, e) => ``;

        // Simpler approach: run separate targeted queries per metric in parallel
        // Category Size = SUM(sales) per platform
        const buildCatSizeQuery = (s, e) => `
            SELECT platform,
                   SUM(toFloat64OrZero(toString(sales))) as category_size
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${s}' AND '${e}'
            ${baseCond}
            AND platform IS NOT NULL AND platform != ''
            GROUP BY platform
        `;

        // MW Market Share = SUM(mars_sales) / SUM(total_sales) * 100 per platform
        // We run two queries: mw_sales and total_sales per platform
        const buildMwSalesQuery = (s, e) => `
            SELECT platform,
                   SUM(toFloat64OrZero(toString(sales))) as mw_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${s}' AND '${e}'
            ${baseCond}
            AND ${marsFilter}
            AND platform IS NOT NULL AND platform != ''
            GROUP BY platform
        `;

        const buildMlQuery = (s, e) => `
            SELECT platform, group_brand as brand,
                   SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${s}' AND '${e}'
            ${baseCond}
            AND group_brand IS NOT NULL AND group_brand != ''
            AND platform IS NOT NULL AND platform != ''
            GROUP BY platform, group_brand
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
            queryClickHouse(buildMwSalesQuery(startStr, endStr)),
            queryClickHouse(buildMwSalesQuery(prevStartStr, prevEndStr)),
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

            // MW Market Share = mw_sales / category_size * 100
            const mwSalesCurrVal = parseFloat(mwCurrMap[platKey]?.mw_sales || 0);
            const mwSalesPrevVal = parseFloat(mwPrevMap[platKey]?.mw_sales || 0);
            const mwMsCurr = catCurr > 0 ? (mwSalesCurrVal / catCurr) * 100 : 0;
            const mwMsPrev = catPrev > 0 ? (mwSalesPrevVal / catPrev) * 100 : 0;
            const mwMsDelta = calcDelta(mwMsCurr, mwMsPrev);

            const mwSalesCurr = mwSalesCurrVal;
            const mwSalesPrev = mwSalesPrevVal;
            const mwSalesDelta = calcDelta(mwSalesCurr, mwSalesPrev);

            const mlRow = mlCurrMap[platKey];
            const mlPrevRow = mlPrevMap[platKey];
            const mlSalesCurr = parseFloat(mlRow?.total_sales || 0);
            const mlSalesPrev = parseFloat(mlPrevRow?.total_sales || 0);
            const mlSalesDelta = calcDelta(mlSalesCurr, mlSalesPrev);
            // ML Market Share = ml_sales / category_size * 100
            const mlMsCurr = catCurr > 0 ? (mlSalesCurr / catCurr) * 100 : 0;
            const mlMsPrev = catPrev > 0 ? (mlSalesPrev / catPrev) * 100 : 0;
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

        const allMwSalesCurr = mwCurr.reduce((s, r) => s + parseFloat(r.mw_sales || 0), 0);
        const allMwSalesPrev = mwPrev.reduce((s, r) => s + parseFloat(r.mw_sales || 0), 0);
        const allMwSalesDelta = calcDelta(allMwSalesCurr, allMwSalesPrev);

        // MW Market Share overall = total_mw_sales / total_cat_size * 100
        const allMwMsCurr = allCatCurr > 0 ? (allMwSalesCurr / allCatCurr) * 100 : 0;
        const allMwMsPrev = allCatPrev > 0 ? (allMwSalesPrev / allCatPrev) * 100 : 0;
        const allMwMsDelta = calcDelta(allMwMsCurr, allMwMsPrev);

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

        // ML market share overall = ml_sales / cat_size * 100
        const allMlMsCurr = allCatCurr > 0 ? (allMlSalesCurr / allCatCurr) * 100 : 0;
        const allMlMsPrev = allCatPrev > 0 ? (allMlSalesPrev / allCatPrev) * 100 : 0;
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

        // Denominator condition: category size should NOT include brand filter
        // Market Share denominator = total sales for the ENTIRE category, not just the selected brand
        let denomCond = `${locationCond} ${platformCond}`;
        let denomCategoryCond = categoryCond;
        if ((!categoryArr || categoryArr.length === 0 || categoryArr.includes('All')) &&
            brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            // Find categories the selected brands belong to
            const catLookupQuery = `
                SELECT DISTINCT category
                FROM rb_ms_olap
                WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
                ${platformCond}
                ${locationCond}
                AND brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})
                AND category IS NOT NULL AND category != ''
            `;
            const catLookupResult = await queryClickHouse(catLookupQuery);
            const brandCategories = catLookupResult.map(r => r.category).filter(Boolean);
            if (brandCategories.length > 0) {
                denomCategoryCond = `AND category IN (${brandCategories.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
            }
        }
        denomCond = `${denomCond} ${denomCategoryCond}`;

        const marsFilter = `(
            lower(group_brand) LIKE '%mars%'
            OR lower(group_brand) LIKE '%wrigley%'
            OR lower(group_brand) LIKE '%snickers%'
            OR lower(group_brand) LIKE '%galaxy%'
            OR lower(group_brand) LIKE '%bounty%'
            OR lower(group_brand) LIKE '%twix%'
            OR lower(group_brand) LIKE '%m&m%'
            OR lower(group_brand) LIKE '%orbit%'
            OR lower(group_brand) LIKE '%skittles%'
            OR lower(group_brand) LIKE '%boomer%'
            OR lower(group_brand) LIKE '%doublemint%'
        )`;

        // Query 1: Category Size per period = SUM(sales) for all brands in the category (denominator)
        const catSizeQuery = `
            SELECT
                ${dateGroupPart} as d,
                SUM(toFloat64OrZero(toString(sales))) as category_size
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${denomCond}
            GROUP BY d
            ORDER BY d ASC
        `;

        // Query 2: MW Sales & Market Share per period
        const mwQuery = `
            SELECT
                ${dateGroupPart} as d,
                SUM(toFloat64OrZero(toString(sales))) as mw_sales
            FROM rb_ms_olap
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
                total_sales as ml_sales
            FROM (
                SELECT
                    d,
                    group_brand as brand,
                    SUM(toFloat64OrZero(toString(sales))) as total_sales
                FROM rb_ms_olap
                WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
                ${baseCond}
                AND group_brand IS NOT NULL AND group_brand != ''
                GROUP BY d, group_brand
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
            row._rawCategorySize = parseFloat(r.category_size) || 0;
        });

        // Populate MW data
        mwData.forEach(r => {
            const row = getRow(r.d);
            const mwSales = parseFloat(r.mw_sales || 0);
            row.MWSales = parseFloat((mwSales / 10000000).toFixed(2)); // in Cr

            const catSize = row._rawCategorySize || 0;
            row.MWMarketShare = catSize > 0 ? parseFloat(((mwSales / catSize) * 100).toFixed(2)) : 0;
        });

        // Populate ML data
        Object.entries(topMlByDate).forEach(([dateStr, r]) => {
            const row = getRow(dateStr);
            const mlSales = parseFloat(r.ml_sales || 0);
            row.MLSales = parseFloat((mlSales / 10000000).toFixed(2)); // in Cr

            const catSize = row._rawCategorySize || 0;
            row.MLMarketShare = catSize > 0 ? parseFloat(((mlSales / catSize) * 100).toFixed(2)) : 0;
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
            brandCond = `AND group_brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`;
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

        // Denominator condition: category size should NOT include brand filter
        // Market Share = brand_sales / total_category_sales * 100
        // The denominator must be total sales for the ENTIRE category, not just the selected brand.
        let denomCond = `${locationCond} ${platformCond}`;

        // If a category filter is provided, use it directly for the denominator.
        // If NOT, but a brand filter IS provided, look up which categories the brand belongs to
        // so the denominator is scoped to those categories.
        let denomCategoryCond = categoryCond;
        if ((!categoryArr || categoryArr.length === 0 || categoryArr.includes('All')) &&
            brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            // Find categories the selected brands belong to
            const catLookupQuery = `
                SELECT DISTINCT category
                FROM rb_ms_olap
                WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
                ${platformCond}
                ${locationCond}
                AND group_brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})
                AND category IS NOT NULL AND category != ''
            `;
            const catLookupResult = await queryClickHouse(catLookupQuery);
            const brandCategories = catLookupResult.map(r => r.category).filter(Boolean);
            if (brandCategories.length > 0) {
                denomCategoryCond = `AND category IN (${brandCategories.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
            }
        }
        denomCond = `${denomCond} ${denomCategoryCond}`;

        // Get current period data
        const currentQuery = `
            SELECT 
                group_brand as brand_name,
                SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            GROUP BY group_brand
            ORDER BY total_sales DESC
        `;

        // Get previous period data
        const prevQuery = `
            SELECT 
                group_brand as brand_name,
                SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            GROUP BY group_brand
        `;

        // Category size denominator: total sales for the category scope, WITHOUT brand filter
        // This ensures Market Share = brand_sales / total_category_sales * 100
        const catSizeQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_category_size
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${denomCond}
        `;

        // Get current period sku data
        const currentSkuQuery = `
            SELECT 
                item_name as sku_name,
                group_brand as brand_name,
                SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            AND item_name IS NOT NULL AND item_name != ''
            GROUP BY item_name, group_brand
            ORDER BY total_sales DESC
        `;

        const prevSkuQuery = `
            SELECT 
                item_name as sku_name,
                group_brand as brand_name,
                SUM(toFloat64OrZero(toString(sales))) as total_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
            AND item_name IS NOT NULL AND item_name != ''
            GROUP BY item_name, group_brand
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

        const formatNumeric = val => parseFloat(Number(val || 0).toFixed(2));

        const brands = currRows.map(curr => {
            const prev = prevMap[curr.brand_name] || { total_sales: 0 };

            const msCurrRaw = totalCatSize > 0 ? (curr.total_sales / totalCatSize) * 100 : 0;
            const msPrevRaw = totalCatSize > 0 ? (prev.total_sales / totalCatSize) * 100 : 0;

            const msCurr = formatNumeric(msCurrRaw);
            const msPrev = formatNumeric(msPrevRaw);
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
            const prev = prevSkuMap[curr.sku_name] || { total_sales: 0 };

            const msCurrRaw = totalCatSize > 0 ? (curr.total_sales / totalCatSize) * 100 : 0;
            const msPrevRaw = totalCatSize > 0 ? (prev.total_sales / totalCatSize) * 100 : 0;

            const msCurr = formatNumeric(msCurrRaw);
            const msPrev = formatNumeric(msPrevRaw);
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
            FROM rb_ms_olap 
            WHERE ${baseCond} AND category IS NOT NULL AND category != ''
            ORDER BY category
        `;

        // Brands: Filtered by Selection + Categories
        let brandCond = baseCond;
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            brandCond += ` AND category IN (${categoryArr.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }
        const brandQuery = `
            SELECT DISTINCT group_brand as brand 
            FROM rb_ms_olap 
            WHERE ${brandCond} AND group_brand IS NOT NULL AND group_brand != ''
            ORDER BY group_brand
        `;

        // SKUs: Filtered by Selection + Categories + Brands
        let skuCond = brandCond;
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            skuCond += ` AND group_brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`;
        }
        const skuQuery = `
            SELECT DISTINCT item_name as sku_name 
            FROM rb_ms_olap 
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

        const targetCol = mode === 'brand' ? 'group_brand' : 'item_name';
        let targetCond = "";
        if (targetArr && targetArr.length > 0 && !targetArr.includes('All')) {
            targetCond = ` AND \`${targetCol}\` IN (${targetArr.map(t => `'${t.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // Query 1: Time series for each target
        const trendQuery = `
            SELECT
                toDate(\`created_on\`) as d,
                \`${targetCol}\` as target,
                SUM(CAST(\`sales\` AS Float64)) as sales
            FROM rb_ms_olap
            WHERE toDate(\`created_on\`) >= '${startStr}' AND toDate(\`created_on\`) <= '${endStr}'
            AND ${baseCond}
            ${targetCond}
            GROUP BY d, target
            ORDER BY d ASC
        `;

        // Query 2: Category size time series (independent of targets)
        const catSizeQuery = `
            SELECT
                toDate(\`created_on\`) as d,
                SUM(CAST(\`sales\` AS Float64)) as category_size
            FROM rb_ms_olap
            WHERE toDate(\`created_on\`) >= '${startStr}' AND toDate(\`created_on\`) <= '${endStr}'
            AND ${baseCond}
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

            const catSize = catMap[dateStr] || 0;
            const ms = catSize > 0 ? (row.sales / catSize) * 100 : 0;

            const targetData = {
                MarketShare: formatNumeric(ms),
                Sales: formatNumeric(row.sales / 10000000) // In Cr
            };

            if (mode !== 'sku') {
                targetData.CategorySize = formatNumeric(catSize / 10000000); // In Cr
            }

            tsByTarget[target][dateStr] = targetData;
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

