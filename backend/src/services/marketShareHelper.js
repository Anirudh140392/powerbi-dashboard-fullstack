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
// Now fully dynamic: returns the original categories verbatim.
export const mapCategoryForMs = (categoryArr) => {
    if (!categoryArr || categoryArr.length === 0) return [];
    return categoryArr;
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
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        // Brands to query (our brands)
        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            // Dynamically fetch our brands (comp_flag = 0)
            const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
            const brandResult = await queryClickHouse(brandQuery);
            brandsToQuery = brandResult.map(b => b.brand_name).filter(Boolean);
            if (brandsToQuery.length === 0) {
                brandsToQuery = ['dummy_no_brands']; // Fallback if no brands found
            }
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        const mappedCats = mapCategoryForMs(categoryArr);
        if (mappedCats.length > 0) {
            categoryCond = `AND lower(category) IN (${mappedCats.map(c => `'${c.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
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
        const ms = totalSales > 0 ? (ourSales / totalSales) * 100 : null;
        return ms !== null ? parseFloat(ms.toFixed(2)) : null;
    } catch (error) {
        console.error('[MarketShare] Error:', error.message);
        return null;
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
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            // Dynamically fetch our brands (comp_flag = 0)
            const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
            const brandResult = await queryClickHouse(brandQuery);
            brandsToQuery = brandResult.map(b => b.brand_name).filter(Boolean);
            if (brandsToQuery.length === 0) {
                brandsToQuery = ['dummy_no_brands']; // Fallback if no brands found
            }
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
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            // Dynamically fetch our brands (comp_flag = 0)
            const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
            const brandResult = await queryClickHouse(brandQuery);
            brandsToQuery = brandResult.map(b => b.brand_name).filter(Boolean);
            if (brandsToQuery.length === 0) {
                brandsToQuery = ['dummy_no_brands']; // Fallback if no brands found
            }
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
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            // Dynamically fetch our brands (comp_flag = 0)
            const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
            const brandResult = await queryClickHouse(brandQuery);
            brandsToQuery = brandResult.map(b => b.brand_name).filter(Boolean);
            if (brandsToQuery.length === 0) {
                brandsToQuery = ['dummy_no_brands']; // Fallback if no brands found
            }
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
export const getMarketLeaderSales = async (start, end, platformFilter, categoryFilter, locationFilter = null, compStart = null, compEnd = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
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
        
        let prevStartStr, prevEndStr;
        if (compStart && compEnd) {
            prevStartStr = compStart.format('YYYY-MM-DD');
            prevEndStr = compEnd.format('YYYY-MM-DD');
        } else {
            const periodDays = end.diff(start, 'day');
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(periodDays, 'day');
            prevStartStr = prevStart.format('YYYY-MM-DD');
            prevEndStr = prevEnd.format('YYYY-MM-DD');
        }

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
            return { brand: 'N/A', sales: 0, prevSales: 0, delta: 0, deltaAbs: 0, trend: [] };
        }

        const leaderBrand = currentResult[0].brand;
        const leaderSales = parseFloat(currentResult[0].total_sales || 0);

        const trendQuery = `
            SELECT formatDateTime(toDate(created_on), '%Y-%m-%d') as date_group,
                   SUM(toFloat64OrZero(toString(sales))) as daily_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            AND group_brand = '${leaderBrand.replace(/'/g, "''")}'
            GROUP BY date_group
            ORDER BY date_group
        `;
        const trendResult = await queryClickHouse(trendQuery);
        const trendMap = {};
        trendResult.forEach(t => trendMap[t.date_group] = parseFloat(t.daily_sales || 0));
        const trend = [];
        let curr = start;
        while (curr.isBefore(end) || curr.isSame(end, 'day')) {
             trend.push(trendMap[curr.format('YYYY-MM-DD')] || 0);
             curr = curr.add(1, 'day');
        }

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
            delta: parseFloat(delta.toFixed(2)),
            deltaAbs: parseFloat(deltaAbs.toFixed(2)),
            trend
        };
    } catch (error) {
        console.error('[MarketLeaderSales] Error:', error.message);
        return { brand: 'N/A', sales: 0, prevSales: 0, delta: 0, deltaAbs: 0, trend: [] };
    }
};

/**
 * Get Mars Wrigley Sales
 * Logic: SUM(sales) WHERE brand is a Mars Wrigley brand
 * Returns: { sales, prevSales, delta, deltaAbs }
 */
export const getMarsWrigleySales = async (start, end, platformFilter, categoryFilter, locationFilter = null, compStart = null, compEnd = null, timeStep = 'Monthly') => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
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
        
        let prevStartStr, prevEndStr;
        if (compStart && compEnd) {
            prevStartStr = compStart.format('YYYY-MM-DD');
            prevEndStr = compEnd.format('YYYY-MM-DD');
        } else {
            const periodDays = end.diff(start, 'day');
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(periodDays, 'day');
            prevStartStr = prevStart.format('YYYY-MM-DD');
            prevEndStr = prevEnd.format('YYYY-MM-DD');
        }

        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // Dynamic "Our Brands" query (comp_flag = 0)
        const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
        const brandResult = await queryClickHouse(brandQuery);
        let ourBrands = brandResult.map(b => b.brand_name).filter(Boolean);
        if (ourBrands.length === 0) {
            ourBrands = ['dummy_no_brands'];
        }
        const marsFilter = `AND lower(group_brand) IN (${ourBrands.map(b => `'${b.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;

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

        // Dynamic grouping based on timeStep: Daily for Quickcomm, Monthly for Ecommerce
        const isDaily = timeStep === 'Daily';
        const groupExpr = isDaily
            ? `toString(toDate(created_on))`
            : `formatDateTime(toDate(created_on), '%Y-%m-01')`;

        const trendQuery = `
            SELECT ${groupExpr} as date_group,
                   SUM(toFloat64OrZero(toString(sales))) as period_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            ${marsFilter}
            GROUP BY date_group
            ORDER BY date_group
        `;

        const [currentResult, prevResult, trendResult] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery),
            queryClickHouse(trendQuery)
        ]);

        const trendMap = {};
        trendResult.forEach(t => trendMap[t.date_group] = parseFloat(t.period_sales || 0));
        const trend = [];
        if (isDaily) {
            let curr = start;
            while (curr.isBefore(end) || curr.isSame(end, 'day')) {
                const key = curr.format('YYYY-MM-DD');
                trend.push({
                    label: curr.format('DD MMM'),
                    value: parseFloat((trendMap[key] || 0).toFixed(2))
                });
                curr = curr.add(1, 'day');
            }
        } else {
            let curr = start.startOf('month');
            const finalEnd = end.startOf('month');
            while (curr.isBefore(finalEnd) || curr.isSame(finalEnd, 'month')) {
                const key = curr.format('YYYY-MM-01');
                trend.push({
                    label: curr.format('MMM YYYY'),
                    value: parseFloat((trendMap[key] || 0).toFixed(2))
                });
                curr = curr.add(1, 'month');
            }
        }

        const sales = parseFloat(currentResult?.[0]?.total_sales || 0);
        const prevSales = parseFloat(prevResult?.[0]?.total_sales || 0);
        const deltaAbs = sales - prevSales;
        const delta = prevSales > 0 ? ((deltaAbs / prevSales) * 100) : 0;

        return {
            sales,
            prevSales,
            delta: parseFloat(delta.toFixed(2)),
            deltaAbs: parseFloat(deltaAbs.toFixed(2)),
            trend
        };
    } catch (error) {
        console.error('[MarsWrigleySales] Error:', error.message);
        return { sales: 0, prevSales: 0, delta: 0, deltaAbs: 0, trend: [] };
    }
};

/**
 * Get Total Category Size
 * Logic: SUM of all sales in rb_ms_olap for the selected category/platform/date range
 */

export const getCategorySize = async (start, end, platformFilter, categoryFilter, locationFilter = null, compStart = null, compEnd = null, timeStep = 'Monthly') => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        let categoryCond = '';
        const mappedCats = mapCategoryForMs(categoryArr);
        if (mappedCats.length > 0) {
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');
        
        let prevStartStr, prevEndStr;
        if (compStart && compEnd) {
            prevStartStr = compStart.format('YYYY-MM-DD');
            prevEndStr = compEnd.format('YYYY-MM-DD');
        } else {
            const periodDays = end.diff(start, 'day');
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(periodDays, 'day');
            prevStartStr = prevStart.format('YYYY-MM-DD');
            prevEndStr = prevEnd.format('YYYY-MM-DD');
        }

        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        const currentQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_category_size
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
        `;

        const prevQuery = `
            SELECT SUM(toFloat64OrZero(toString(sales))) as total_category_size
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
        `;

        // Dynamic grouping based on timeStep: Daily for Quickcomm, Monthly for Ecommerce
        const isDaily = timeStep === 'Daily';
        const groupExpr = isDaily
            ? `toString(toDate(created_on))`
            : `formatDateTime(toDate(created_on), '%Y-%m-01')`;

        const trendQuery = `
            SELECT ${groupExpr} as date_group,
                   SUM(toFloat64OrZero(toString(sales))) as period_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            GROUP BY date_group
            ORDER BY date_group
        `;

        const [currentResult, prevResult, trendResult] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery),
            queryClickHouse(trendQuery)
        ]);

        const trendMap = {};
        trendResult.forEach(t => trendMap[t.date_group] = parseFloat(t.period_sales || 0));
        const trend = [];
        if (isDaily) {
            let curr = start;
            while (curr.isBefore(end) || curr.isSame(end, 'day')) {
                const key = curr.format('YYYY-MM-DD');
                trend.push({
                    label: curr.format('DD MMM'),
                    value: parseFloat((trendMap[key] || 0).toFixed(2))
                });
                curr = curr.add(1, 'day');
            }
        } else {
            let curr = start.startOf('month');
            const finalEnd = end.startOf('month');
            while (curr.isBefore(finalEnd) || curr.isSame(finalEnd, 'month')) {
                const key = curr.format('YYYY-MM-01');
                trend.push({
                    label: curr.format('MMM YYYY'),
                    value: parseFloat((trendMap[key] || 0).toFixed(2))
                });
                curr = curr.add(1, 'month');
            }
        }

        const size = parseFloat(currentResult?.[0]?.total_category_size || 0);
        const prevSize = parseFloat(prevResult?.[0]?.total_category_size || 0);
        const deltaAbs = size - prevSize;
        const delta = prevSize > 0 ? ((deltaAbs / prevSize) * 100) : 0;

        return {
            size,
            prevSize,
            delta: parseFloat(delta.toFixed(2)),
            deltaAbs: parseFloat(deltaAbs.toFixed(2)),
            trend
        };
    } catch (error) {
        console.error('[CategorySize] Error:', error.message);
        return { size: 0, prevSize: 0, delta: 0, deltaAbs: 0, trend: [] };
    }
};

/**
 * Get Market Share KPI
 * Logic: (Our Sales / Total Category Sales) * 100
 * Returns: { share, prevShare, delta, trend }
 */
export const getMarketShareKPI = async (start, end, platformFilter, categoryFilter, locationFilter = null, compStart = null, compEnd = null, timeStep = 'Monthly') => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        let categoryCond = '';
        const mappedCats = mapCategoryForMs(categoryArr);
        if (mappedCats.length > 0) {
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');
        
        let prevStartStr, prevEndStr;
        if (compStart && compEnd) {
            prevStartStr = compStart.format('YYYY-MM-DD');
            prevEndStr = compEnd.format('YYYY-MM-DD');
        } else {
            const periodDays = end.diff(start, 'day');
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(periodDays, 'day');
            prevStartStr = prevStart.format('YYYY-MM-DD');
            prevEndStr = prevEnd.format('YYYY-MM-DD');
        }

        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // Get our brands
        const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
        const brandResult = await queryClickHouse(brandQuery);
        let ourBrands = brandResult.map(b => b.brand_name).filter(Boolean);
        if (ourBrands.length === 0) ourBrands = ['dummy_no_brands'];
        const brandsSql = ourBrands.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        // Current & Previous Share
        const currentQuery = `
            SELECT 
                SUM(toFloat64OrZero(toString(sales))) as total_sales,
                SUM(IF(group_brand IN (${brandsSql}), toFloat64OrZero(toString(sales)), 0)) as our_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
        `;

        const prevQuery = `
            SELECT 
                SUM(toFloat64OrZero(toString(sales))) as total_sales,
                SUM(IF(group_brand IN (${brandsSql}), toFloat64OrZero(toString(sales)), 0)) as our_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${baseCond}
        `;

        // Dynamic grouping based on timeStep: Daily for Quickcomm, Monthly for Ecommerce
        const isDaily = timeStep === 'Daily';
        const groupExpr = isDaily
            ? `toString(toDate(created_on))`
            : `formatDateTime(toDate(created_on), '%Y-%m-01')`;

        // Trend Query
        const trendQuery = `
            SELECT 
                ${groupExpr} as date_group,
                SUM(toFloat64OrZero(toString(sales))) as total_sales,
                SUM(IF(group_brand IN (${brandsSql}), toFloat64OrZero(toString(sales)), 0)) as our_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            GROUP BY date_group
            ORDER BY date_group
        `;

        const [currentRes, prevRes, trendRes] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery),
            queryClickHouse(trendQuery)
        ]);

        const curTotal = parseFloat(currentRes?.[0]?.total_sales || 0);
        const curOur = parseFloat(currentRes?.[0]?.our_sales || 0);
        const share = curTotal > 0 ? (curOur / curTotal) * 100 : null;

        const prevTotal = parseFloat(prevRes?.[0]?.total_sales || 0);
        const prevOur = parseFloat(prevRes?.[0]?.our_sales || 0);
        const prevShare = prevTotal > 0 ? (prevOur / prevTotal) * 100 : null;

        const delta = (share !== null && prevShare !== null) ? share - prevShare : null;

        const trendMap = {};
        trendRes.forEach(t => {
            const tTotal = parseFloat(t.total_sales || 0);
            const tOur = parseFloat(t.our_sales || 0);
            trendMap[t.date_group] = tTotal > 0 ? (tOur / tTotal) * 100 : 0;
        });

        const trend = [];
        if (isDaily) {
            let curr = start;
            while (curr.isBefore(end) || curr.isSame(end, 'day')) {
                const key = curr.format('YYYY-MM-DD');
                trend.push({
                    label: curr.format('DD MMM'),
                    value: parseFloat((trendMap[key] || 0).toFixed(2))
                });
                curr = curr.add(1, 'day');
            }
        } else {
            let curr = start.startOf('month');
            const finalEnd = end.startOf('month');
            while (curr.isBefore(finalEnd) || curr.isSame(finalEnd, 'month')) {
                const key = curr.format('YYYY-MM-01');
                trend.push({
                    label: curr.format('MMM YYYY'),
                    value: parseFloat((trendMap[key] || 0).toFixed(2))
                });
                curr = curr.add(1, 'month');
            }
        }

        return {
            share: share !== null ? parseFloat(share.toFixed(2)) : null,
            prevShare: prevShare !== null ? parseFloat(prevShare.toFixed(2)) : null,
            delta: delta !== null ? parseFloat(delta.toFixed(2)) : null,
            trend
        };
    } catch (error) {
        console.error('[MarketShareKPI] Error:', error.message);
        return { share: 0, prevShare: 0, delta: 0, trend: [] };
    }
};

/**
 * Get Sub-Category KPI data
 * Returns: list of categories + brand-level KPIs for a given category
 * KPIs: market_share (sales-based), total_sales
 * Includes delta vs previous period of equal length
 * NOTE: rb_ms_olap does not have sub_category, so we use category instead
 */
export const getSubCategoryKpi = async (start, end, platformFilter, categoryFilter, locationFilter = null, subCategoryFilter = null, compStart = null, compEnd = null, brandFilter = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        // Build shared filter conditions
        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `lower(platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = mapCategoryForMs(categoryArr);
            categoryCond = `AND category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const brandArr = normalizeFilterArray(brandFilter);
        let brandCond = '';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandCond = `AND group_brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');

        let prevStartStr, prevEndStr;
        if (compStart && compEnd) {
            prevStartStr = compStart.format('YYYY-MM-DD');
            prevEndStr = compEnd.format('YYYY-MM-DD');
        } else {
            // Calculate previous period (same length, immediately prior)
            const periodDays = end.diff(start, 'day');
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(periodDays, 'day');
            prevStartStr = prevStart.format('YYYY-MM-DD');
            prevEndStr = prevEnd.format('YYYY-MM-DD');
        }

        const baseCond = `
            ${platformCond}
            ${locationCond}
            ${categoryCond}
            ${brandCond}
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
        const targetSubCats = normalizeFilterArray(subCategoryFilter);
        const hasTargetSubCats = targetSubCats.length > 0;
        const targetSubCat = hasTargetSubCats ? targetSubCats[0] : (subCategories.length > 0 ? subCategories[0] : null);

        if (!targetSubCat && !hasTargetSubCats) {
            return { subCategories: [], brands: [], selectedSubCategory: null };
        }

        let subCatCond = '';
        if (hasTargetSubCats) {
            subCatCond = `AND category IN (${targetSubCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        } else {
            subCatCond = `AND category = '${targetSubCat.replace(/'/g, "''")}'`;
        }

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

        // 4a. SOS queries for Overall Share of Visibility & Paid Share of Visibility using rb_kw_olap (matching WatchTower Brand page)

        let kwPlatformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `lower(platform_name) LIKE '%${p.toLowerCase().replace(/'/g, "''")}%'`).join(' OR ');
            kwPlatformCond = `AND (${platformConds})`;
        }

        let kwLocationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            kwLocationCond = `AND lower(location_name) IN (${locationArr.map(l => `'${l.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        }

        let kwCategoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = mapCategoryForMs(categoryArr);
            kwCategoryCond = `AND lower(keyword_category) IN (${mappedCats.map(c => `'${c.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        }

        let kwSubCatCond = '';
        if (hasTargetSubCats) {
            kwSubCatCond = `AND lower(keyword_category) IN (${targetSubCats.map(c => `'${c.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        } else if (targetSubCat) {
            kwSubCatCond = `AND lower(keyword_category) = '${targetSubCat.toLowerCase().replace(/'/g, "''")}'`;
        }

        const kwBaseCond = `
            ${kwPlatformCond}
            ${kwLocationCond}
            ${kwCategoryCond}
            AND keyword_category IS NOT NULL AND keyword_category != ''
        `;

        // Denominator: total sum(overall)/sum(spons) across ALL brands with SAME selected filters
        const currDenomQuery = `
            SELECT sum(toInt32(overall)) as total_overall, sum(toInt32(spons)) as total_spons
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '${startStr}' AND '${endStr}'
            ${kwBaseCond}
            ${kwSubCatCond}
        `;

        const prevDenomQuery = `
            SELECT sum(toInt32(overall)) as total_overall, sum(toInt32(spons)) as total_spons
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${kwBaseCond}
            ${kwSubCatCond}
        `;

        // Numerators: per-brand sum(overall)/sum(spons) where flag='1' (our brand rows)
        const currSOSNumQuery = `
            SELECT brand_name_th as brand,
                   sum(toInt32(overall)) as overall_num,
                   sum(toInt32(spons)) as spons_num
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '${startStr}' AND '${endStr}'
            ${kwBaseCond}
            ${kwSubCatCond}
            AND brand_name_th IS NOT NULL AND brand_name_th != ''
            GROUP BY brand_name_th
        `;

        const prevSOSNumQuery = `
            SELECT brand_name_th as brand,
                   sum(toInt32(overall)) as overall_num,
                   sum(toInt32(spons)) as spons_num
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '${prevStartStr}' AND '${prevEndStr}'
            ${kwBaseCond}
            ${kwSubCatCond}
            AND brand_name_th IS NOT NULL AND brand_name_th != ''
            GROUP BY brand_name_th
        `;

        const [currDenomResult, prevDenomResult, currSOSNumResults, prevSOSNumResults] = await Promise.all([
            queryClickHouse(currDenomQuery),
            queryClickHouse(prevDenomQuery),
            queryClickHouse(currSOSNumQuery),
            queryClickHouse(prevSOSNumQuery)
        ]);

        const currTotalOverall = parseInt(currDenomResult[0]?.total_overall || 0);
        const currTotalSpons = parseInt(currDenomResult[0]?.total_spons || 0);
        const prevTotalOverall = parseInt(prevDenomResult[0]?.total_overall || 0);
        const prevTotalSpons = parseInt(prevDenomResult[0]?.total_spons || 0);

        console.log(`[SubCategoryKpi SOV DEBUG] currTotalOverall=${currTotalOverall}, currTotalSpons=${currTotalSpons}`);

        // Build SOS numerator lookups (using lowercase keys for matching)
        const currentSOSMap = new Map();
        currSOSNumResults.forEach(r => {
            const overallNum = parseInt(r.overall_num || 0);
            const sponsNum = parseInt(r.spons_num || 0);
            const overallSov = currTotalOverall > 0 ? (overallNum / currTotalOverall) * 100 : 0;
            const paidSov = currTotalSpons > 0 ? (sponsNum / currTotalSpons) * 100 : 0;
            console.log(`[SubCategoryKpi SOV DEBUG] Brand=${r.brand}, overallNum=${overallNum}, overallSov=${overallSov.toFixed(2)}%, sponsNum=${sponsNum}, paidSov=${paidSov.toFixed(2)}%`);
            currentSOSMap.set(String(r.brand).toLowerCase().trim(), { overallSov, paidSov });
        });

        const prevSOSMap = new Map();
        prevSOSNumResults.forEach(r => {
            const overallNum = parseInt(r.overall_num || 0);
            const sponsNum = parseInt(r.spons_num || 0);
            const overallSov = prevTotalOverall > 0 ? (overallNum / prevTotalOverall) * 100 : 0;
            const paidSov = prevTotalSpons > 0 ? (sponsNum / prevTotalSpons) * 100 : 0;
            prevSOSMap.set(String(r.brand).toLowerCase().trim(), { overallSov, paidSov });
        });

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

        // 5. Build brands array with deltas (including SOS)
        const brands = currentResults.map(r => {
            const brandSales = parseFloat(r.total_sales || 0);
            const ms = totalCatSales > 0 ? (brandSales / totalCatSales) * 100 : 0;

            const prev = prevMap.get(r.brand) || { marketShare: 0 };
            const msDelta = parseFloat((ms - prev.marketShare).toFixed(2));

            const brandKey = String(r.brand).toLowerCase().trim();
            const curSOS = currentSOSMap.get(brandKey) || { overallSov: 0, paidSov: 0 };
            const prSOS = prevSOSMap.get(brandKey) || { overallSov: 0, paidSov: 0 };
            const overallSovDelta = parseFloat((curSOS.overallSov - prSOS.overallSov).toFixed(2));
            const paidSovDelta = parseFloat((curSOS.paidSov - prSOS.paidSov).toFixed(2));

            return {
                brand: r.brand,
                metrics: {
                    marketShare: { val: parseFloat(ms.toFixed(2)), delta: msDelta, prevVal: parseFloat(prev.marketShare.toFixed(2)), status: getStatus(msDelta) },
                    overallSov: { val: parseFloat(curSOS.overallSov.toFixed(2)), delta: overallSovDelta, status: getStatus(overallSovDelta) },
                    paidSov: { val: parseFloat(curSOS.paidSov.toFixed(2)), delta: paidSovDelta, status: getStatus(paidSovDelta) }
                }
            };
        });

        return { subCategories, brands, selectedSubCategory: hasTargetSubCats ? targetSubCats : targetSubCat };
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
export const getCrossPlatformOverview = async (start, end, platformFilter, categoryFilter, locationFilter = null, brandFilter = null, compStart = null, compEnd = null) => {
    try {
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);
        const brandArr = normalizeFilterArray(brandFilter);

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
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

        let brandCond = '';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandCond = `AND group_brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');

        let prevStartStr, prevEndStr;
        if (compStart && compEnd) {
            prevStartStr = compStart.format('YYYY-MM-DD');
            prevEndStr = compEnd.format('YYYY-MM-DD');
        } else {
            const periodDays = end.diff(start, 'day');
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(periodDays, 'day');
            prevStartStr = prevStart.format('YYYY-MM-DD');
            prevEndStr = prevEnd.format('YYYY-MM-DD');
        }

        const baseCond = `${locationCond} ${categoryCond} ${brandCond}`;

        // Dynamic "Our Brands" query (comp_flag = 0)
        const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
        const brandResult = await queryClickHouse(brandQuery);
        let ourBrands = brandResult.map(b => b.brand_name).filter(Boolean);
        if (ourBrands.length === 0) {
            ourBrands = ['dummy_no_brands'];
        }
        const marsFilter = `lower(group_brand) IN (${ourBrands.map(b => `'${b.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;

        // Platforms are derived dynamically from query results (no hardcoding)

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
            return { deltaPct: parseFloat(deltaPct.toFixed(2)), deltaAbs: parseFloat(deltaAbs.toFixed(2)), prevVal: parseFloat(prev.toFixed(2)) };
        };

        const buildPlatformData = (platKey) => {
            const catCurr = parseFloat(catSizeCurrMap[platKey]?.category_size || 0);
            const catPrev = parseFloat(catSizePrevMap[platKey]?.category_size || 0);
            const catDelta = calcDelta(catCurr, catPrev);

            // MW Market Share = mw_sales / category_size * 100
            const mwSalesCurrVal = parseFloat(mwCurrMap[platKey]?.mw_sales || 0);
            const mwSalesPrevVal = parseFloat(mwPrevMap[platKey]?.mw_sales || 0);
            const mwMsCurr = catCurr > 0 ? (mwSalesCurrVal / catCurr) * 100 : null;
            const mwMsPrev = catPrev > 0 ? (mwSalesPrevVal / catPrev) * 100 : null;
            const mwMsDelta = (mwMsCurr !== null && mwMsPrev !== null) ? calcDelta(mwMsCurr, mwMsPrev) : null;

            const mwSalesCurr = mwSalesCurrVal;
            const mwSalesPrev = mwSalesPrevVal;
            const mwSalesDelta = calcDelta(mwSalesCurr, mwSalesPrev);

            if (platKey.toLowerCase() === 'blinkit') {
                console.log('[DEBUG] Blinkit MW Sales -> raw:', mwSalesCurrVal, 'formatted:', formatCr(mwSalesCurrVal));
            }

            const mlRow = mlCurrMap[platKey];
            const mlPrevRow = mlPrevMap[platKey];
            const mlSalesCurr = parseFloat(mlRow?.total_sales || 0);
            const mlSalesPrev = parseFloat(mlPrevRow?.total_sales || 0);
            const mlSalesDelta = calcDelta(mlSalesCurr, mlSalesPrev);
            // ML Market Share = ml_sales / category_size * 100
            const mlMsCurr = catCurr > 0 ? (mlSalesCurr / catCurr) * 100 : null;
            const mlMsPrev = catPrev > 0 ? (mlSalesPrev / catPrev) * 100 : null;
            const mlMsDelta = (mlMsCurr !== null && mlMsPrev !== null) ? calcDelta(mlMsCurr, mlMsPrev) : null;

            return {
                categorySize: {
                    raw: catCurr,
                    value: formatCr(catCurr),
                    delta: {
                        value: `${catDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(catDelta.deltaPct)}% (${formatCr(catDelta.prevVal)})`,
                        dir: catDelta.deltaPct >= 0 ? 'up' : 'down'
                    }
                },
                mwMarketShare: {
                    raw: mwMsCurr,
                    value: mwMsCurr !== null ? `${mwMsCurr.toFixed(2)}%` : 'N/A',
                    delta: mwMsDelta ? {
                        value: `${mwMsDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(mwMsDelta.deltaPct)}% (${mwMsDelta.prevVal.toFixed(2)}%)`,
                        dir: mwMsDelta.deltaPct >= 0 ? 'up' : 'down'
                    } : null
                },
                mwSales: {
                    raw: mwSalesCurr,
                    value: formatCr(mwSalesCurr),
                    delta: {
                        value: `${mwSalesDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(mwSalesDelta.deltaPct)}% (${formatCr(mwSalesDelta.prevVal)})`,
                        dir: mwSalesDelta.deltaPct >= 0 ? 'up' : 'down'
                    }
                },
                mlMarketShare: {
                    raw: mlMsCurr,
                    value: mlMsCurr !== null ? `${mlMsCurr.toFixed(2)}%` : 'N/A',
                    delta: mlMsDelta ? {
                        value: `${mlMsDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(mlMsDelta.deltaPct)}% (${mlMsDelta.prevVal.toFixed(2)}%)`,
                        dir: mlMsDelta.deltaPct >= 0 ? 'up' : 'down'
                    } : null
                },
                mlSales: {
                    raw: mlSalesCurr,
                    value: formatCr(mlSalesCurr),
                    delta: {
                        value: `${mlSalesDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(mlSalesDelta.deltaPct)}% (${formatCr(mlSalesDelta.prevVal)})`,
                        dir: mlSalesDelta.deltaPct >= 0 ? 'up' : 'down'
                    }
                },
                mlBrand: mlRow?.brand || 'N/A'
            };
        };

        // Build per-platform results — derive platforms dynamically from catSizeCurr
        const result = {};
        const discoveredPlatforms = [...new Set(catSizeCurr.map(r => r.platform).filter(Boolean))];
        discoveredPlatforms.forEach(p => {
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
                delta: { value: `${allCatDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allCatDelta.deltaPct)}% (${formatCr(allCatDelta.prevVal)})`, dir: allCatDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mwMarketShare: {
                raw: allMwMsCurr,
                value: `${allMwMsCurr.toFixed(2)}%`,
                delta: { value: `${allMwMsDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allMwMsDelta.deltaPct)}% (${allMwMsDelta.prevVal.toFixed(2)}%)`, dir: allMwMsDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mwSales: {
                raw: allMwSalesCurr,
                value: formatCr(allMwSalesCurr),
                delta: { value: `${allMwSalesDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allMwSalesDelta.deltaPct)}% (${formatCr(allMwSalesDelta.prevVal)})`, dir: allMwSalesDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mlMarketShare: {
                raw: allMlMsCurr,
                value: `${allMlMsCurr.toFixed(2)}%`,
                delta: { value: `${allMlMsDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allMlMsDelta.deltaPct)}% (${allMlMsDelta.prevVal.toFixed(2)}%)`, dir: allMlMsDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mlSales: {
                raw: allMlSalesCurr,
                value: formatCr(allMlSalesCurr),
                delta: { value: `${allMlSalesDelta.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(allMlSalesDelta.deltaPct)}% (${formatCr(allMlSalesDelta.prevVal)})`, dir: allMlSalesDelta.deltaPct >= 0 ? 'up' : 'down' }
            },
            mlBrand: overallMlBrand ? overallMlBrand[0] : 'N/A'
        };

        // Include available platform keys for the frontend
        result._availablePlatforms = ['odd_overall', ...discoveredPlatforms.map(p => p.toLowerCase())];

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

        const locationCond = (locationArr.length > 0 && !locationArr.includes('All')) ? `AND lower(location) IN (${locationArr.map(l => `'${l.toLowerCase().replace(/'/g, "''")}'`).join(', ')})` : '';
        const categoryCond = (categoryArr.length > 0 && !categoryArr.includes('All')) ? `AND lower(category) IN (${categoryArr.map(c => `'${c.toLowerCase().replace(/'/g, "''")}'`).join(', ')})` : '';
        const platformCond = (platformArr.length > 0 && !platformArr.includes('All')) ? `AND lower(platform) IN (${platformArr.map(p => `'${p.toLowerCase().replace(/'/g, "''")}'`).join(', ')})` : '';
        const brandCond = (brandArr.length > 0 && !brandArr.includes('All')) ? `AND lower(group_brand) IN (${brandArr.map(b => `'${b.toLowerCase().replace(/'/g, "''")}'`).join(', ')})` : '';

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

        // Build KW filters for SOV trends
        let kwPlatformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `lower(platform_name) LIKE '%${p.toLowerCase().replace(/'/g, "''")}%'`).join(' OR ');
            kwPlatformCond = `AND (${platformConds})`;
        }

        let kwLocationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            kwLocationCond = `AND lower(location_name) IN (${locationArr.map(l => `'${l.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        }

        let kwCategoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = mapCategoryForMs(categoryArr);
            kwCategoryCond = `AND lower(keyword_category) IN (${mappedCats.map(c => `'${c.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        }

        const kwBaseCond = `
            ${kwPlatformCond}
            ${kwLocationCond}
            ${kwCategoryCond}
            AND keyword_category IS NOT NULL AND keyword_category != ''
        `;


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

        // Dynamic "Our Brands" query (comp_flag = 0)
        const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
        const brandResult = await queryClickHouse(brandQuery);
        let ourBrands = brandResult.map(b => b.brand_name).filter(Boolean);
        if (ourBrands.length === 0) {
            ourBrands = ['dummy_no_brands'];
        }
        const marsFilter = `lower(group_brand) IN (${ourBrands.map(b => `'${b.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;

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
            ${(brandArr && brandArr.length > 0 && !brandArr.includes('All')) ? '' : `AND ${marsFilter}`}
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
                    ${dateGroupPart} as d,
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

        // Query 4: SOV trends (Overall & Paid)
        let dateGroupPartKW = dateGroupPart.replace(/toDate\(created_on\)/g, 'toDate(DATE)');
        const sovDenomQuery = `
            SELECT
                ${dateGroupPartKW} as d,
                sum(toInt32(overall)) as total_overall,
                sum(toInt32(spons)) as total_spons
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '${startStr}' AND '${endStr}'
            ${kwBaseCond}
            GROUP BY d
        `;

        const kwActiveBrandFilter = (brandArr && brandArr.length > 0 && !brandArr.includes('All')) 
            ? `lower(brand_name_th) IN (${brandArr.map(b => `'${b.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`
            : `lower(brand_name_th) IN (${ourBrands.map(b => `'${b.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;

        const sovNumQuery = `
            SELECT
                ${dateGroupPartKW} as d,
                sum(toInt32(overall)) as our_overall,
                sum(toInt32(spons)) as our_spons
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '${startStr}' AND '${endStr}'
            ${kwBaseCond}
            AND ${kwActiveBrandFilter}
            GROUP BY d
        `;

        const [catData, mwData, mlDataRaw, sovDenomData, sovNumData] = await Promise.all([
            queryClickHouse(catSizeQuery),
            queryClickHouse(mwQuery),
            queryClickHouse(mlQuery),
            queryClickHouse(sovDenomQuery),
            queryClickHouse(sovNumQuery)
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
                    MLSales: 0,
                    OverallSov: 0,
                    PaidSov: 0
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

        // Populate SOV data
        const sovDenomMap = new Map();
        sovDenomData.forEach(r => {
            const key = dayjs(r.d).format('YYYY-MM-DD');
            sovDenomMap.set(key, { total_overall: parseInt(r.total_overall || 0), total_spons: parseInt(r.total_spons || 0) });
        });

        sovNumData.forEach(r => {
            const key = dayjs(r.d).format('YYYY-MM-DD');
            const denom = sovDenomMap.get(key);
            const row = getRow(r.d);
            if (row && denom) {
                row.OverallSov = denom.total_overall > 0 ? parseFloat(((parseInt(r.our_overall || 0) / denom.total_overall) * 100).toFixed(2)) : 0;
                row.PaidSov = denom.total_spons > 0 ? parseFloat(((parseInt(r.our_spons || 0) / denom.total_spons) * 100).toFixed(2)) : 0;
            }
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
export const getMarketShareCompetition = async (period, startDate, endDate, platformFilter, categoryFilter, locationFilter, brandFilter, compareStartDate = null, compareEndDate = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);
        const brandArr = normalizeFilterArray(brandFilter);

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All') && !locationArr.includes('All India')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            categoryCond = `AND lower(category) IN (${categoryArr.map(c => `'${c.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        }

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            platformCond = `AND lower(platform) IN (${platformArr.map(p => `'${p.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandCond = '';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandCond = `AND lower(group_brand) IN (${brandArr.map(b => `'${b.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
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

        let prevStartStr, prevEndStr;
        if (compareStartDate && compareEndDate) {
            const compStartRaw = dayjs(compareStartDate);
            const compEndRaw = dayjs(compareEndDate);
            prevStartStr = compStartRaw.format('YYYY-MM-DD');
            prevEndStr = compEndRaw.format('YYYY-MM-DD');
        } else {
            const periodDays = endRaw.diff(startRaw, 'day');
            const prevEnd = startRaw.subtract(1, 'day');
            const prevStart = prevEnd.subtract(periodDays, 'day');
            prevStartStr = prevStart.format('YYYY-MM-DD');
            prevEndStr = prevEnd.format('YYYY-MM-DD');
        }

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

        // --- SOV Aggregation for Competition ---
        const platformBase = (platformArr && platformArr.length > 0 && !platformArr.includes('All')) ? platformArr[0] : 'Blinkit';
        const kwBaseCond = buildKwBaseCond(platformBase, categoryArr);

        const sovDenomQuery = `
            SELECT 
                SUM(is_overall) as total_overall,
                SUM(is_sponsored) as total_spons
            FROM rb_kw_olap
            WHERE toDate(d) BETWEEN '${startStr}' AND '${endStr}'
            AND ${kwBaseCond}
        `;

        const sovBrandQuery = `
            SELECT 
                group_brand as brand_name,
                SUM(is_overall) as our_overall,
                SUM(is_sponsored) as our_spons
            FROM rb_kw_olap
            WHERE toDate(d) BETWEEN '${startStr}' AND '${endStr}'
            AND ${kwBaseCond}
            GROUP BY group_brand
        `;

        const sovSkuQuery = `
            SELECT 
                sku_name,
                SUM(is_overall) as our_overall,
                SUM(is_sponsored) as our_spons
            FROM rb_kw_olap
            WHERE toDate(d) BETWEEN '${startStr}' AND '${endStr}'
            AND ${kwBaseCond}
            AND sku_name IS NOT NULL AND sku_name != ''
            GROUP BY sku_name
        `;

        const [currRows, prevRows, catResult, currSkuRows, prevSkuRows, sovDenomResult, sovBrandResult, sovSkuResult] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery),
            queryClickHouse(catSizeQuery),
            queryClickHouse(currentSkuQuery),
            queryClickHouse(prevSkuQuery),
            queryClickHouse(sovDenomQuery),
            queryClickHouse(sovBrandQuery),
            queryClickHouse(sovSkuQuery)
        ]);

        const totalCatSize = catResult?.[0]?.total_category_size || 0;
        const totalOverall = parseInt(sovDenomResult?.[0]?.total_overall || 0);
        const totalSpons = parseInt(sovDenomResult?.[0]?.total_spons || 0);

        const sovBrandMap = {};
        sovBrandResult.forEach(r => {
            sovBrandMap[r.brand_name] = {
                OverallSov: totalOverall > 0 ? formatNumeric((parseInt(r.our_overall || 0) / totalOverall) * 100) : 0,
                PaidSov: totalSpons > 0 ? formatNumeric((parseInt(r.our_spons || 0) / totalSpons) * 100) : 0
            };
        });

        const sovSkuMap = {};
        sovSkuResult.forEach(r => {
            sovSkuMap[r.sku_name] = {
                OverallSov: totalOverall > 0 ? formatNumeric((parseInt(r.our_overall || 0) / totalOverall) * 100) : 0,
                PaidSov: totalSpons > 0 ? formatNumeric((parseInt(r.our_spons || 0) / totalSpons) * 100) : 0
            };
        });

        const prevMap = {};
        prevRows.forEach(row => {
            prevMap[row.brand_name] = row;
        });

        const formatNumeric = val => parseFloat(Number(val || 0).toFixed(2));

        const brands = currRows.map(curr => {
            const prev = prevMap[curr.brand_name] || { total_sales: 0 };
            const sov = sovBrandMap[curr.brand_name] || { OverallSov: 0, PaidSov: 0 };

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
                OverallSov: { value: sov.OverallSov, delta: 0 },
                PaidSov: { value: sov.PaidSov, delta: 0 },
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
            const sov = sovSkuMap[curr.sku_name] || { OverallSov: 0, PaidSov: 0 };

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
                },
                OverallSov: { value: sov.OverallSov, delta: 0 },
                PaidSov: { value: sov.PaidSov, delta: 0 }
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

        const hasPlatform = platformArr && platformArr.length > 0 && !platformArr.includes('All');
        const hasLocation = locationArr && locationArr.length > 0 && !locationArr.includes('All') && !locationArr.includes('All India');
        const hasCategory = categoryArr && categoryArr.length > 0 && !categoryArr.includes('All');
        const hasBrand = brandArr && brandArr.length > 0 && !brandArr.includes('All');

        const platformCond = hasPlatform ? `AND lower(platform) IN (${platformArr.map(p => `'${p.toLowerCase().replace(/'/g, "''")}'`).join(', ')})` : '';
        const locationCond = hasLocation ? `AND lower(location) IN (${locationArr.map(l => `'${l.toLowerCase().replace(/'/g, "''")}'`).join(', ')})` : '';
        const categoryCond = hasCategory ? `AND lower(category) IN (${categoryArr.map(c => `'${c.toLowerCase().replace(/'/g, "''")}'`).join(', ')})` : '';
        const brandCond = hasBrand ? `AND lower(group_brand) IN (${brandArr.map(b => `'${b.toLowerCase().replace(/'/g, "''")}'`).join(', ')})` : '';

        // Platforms: Filtered by Location + Category + Brand
        const platformQuery = `
            SELECT DISTINCT platform 
            FROM rb_ms_olap 
            WHERE 1=1 ${locationCond} ${categoryCond} ${brandCond}
            AND platform IS NOT NULL AND platform != ''
            ORDER BY platform
        `;

        // Categories: Filtered by Platform + Location + Brand
        const categoryQuery = `
            SELECT DISTINCT category 
            FROM rb_ms_olap 
            WHERE 1=1 ${platformCond} ${locationCond} ${brandCond}
            AND category IS NOT NULL AND category != ''
            ORDER BY category
        `;

        // Brands: Filtered by Platform + Location + Category
        const brandQuery = `
            SELECT DISTINCT group_brand as brand 
            FROM rb_ms_olap 
            WHERE 1=1 ${platformCond} ${locationCond} ${categoryCond}
            AND group_brand IS NOT NULL AND group_brand != ''
            ORDER BY group_brand
        `;

        // SKUs: Filtered by Platform + Location + Category + Brand
        const skuQuery = `
            SELECT DISTINCT item_name as sku_name 
            FROM rb_ms_olap 
            WHERE 1=1 ${platformCond} ${locationCond} ${categoryCond} ${brandCond}
            AND item_name IS NOT NULL AND item_name != ''
            ORDER BY item_name
        `;

        const [platformResults, catResults, brandResults, skuResults] = await Promise.all([
            queryClickHouse(platformQuery),
            queryClickHouse(categoryQuery),
            queryClickHouse(brandQuery),
            queryClickHouse(skuQuery)
        ]);

        return {
            platforms: platformResults.map(r => r.platform),
            categories: catResults.map(r => r.category),
            brands: brandResults.map(r => r.brand),
            skus: skuResults.map(r => r.sku_name)
        };
    } catch (error) {
        console.error('[MarketShareFilterOptions] Error:', error.message);
        return { platforms: [], categories: [], brands: [], skus: [] };
    }
};

/**
 * Get Top-level Market Share Filter Options (Platform, Category, Channel)
 * Sourced directly from rb_ms_olap as per user request.
 */
export const getMarketShareTopFilterOptions = async (channelFilter = null) => {
    try {
        // 1. Get ALL distinct platforms from rb_ms_olap (the source of truth for Market Share)
        const allPlatformResults = await queryClickHouse(
            `SELECT DISTINCT platform FROM rb_ms_olap WHERE platform IS NOT NULL AND platform != '' ORDER BY platform`
        );
        const allMsPlatforms = allPlatformResults.map(r => r.platform);

        // 2. Build platform-to-channel mapping from rca_sku_dim (only for platforms that exist in rb_ms_olap)
        //    This determines which channel each platform belongs to
        let platformChannelMap = new Map(); // platform -> channel
        let channelSet = new Set();
        try {
            if (allMsPlatforms.length > 0) {
                const platformList = allMsPlatforms.map(p => `'${p.replace(/'/g, "''")}'`).join(', ');
                const mappingResults = await queryClickHouse(`
                    SELECT DISTINCT platform, channel 
                    FROM rca_sku_dim 
                    WHERE platform IN (${platformList}) 
                    AND channel IS NOT NULL AND channel != ''
                `);
                mappingResults.forEach(r => {
                    if (r.platform && r.channel) {
                        platformChannelMap.set(r.platform.toLowerCase(), r.channel);
                        channelSet.add(r.channel);
                    }
                });
            }
        } catch (mapErr) {
            console.warn('[MarketShareTopFilterOptions] rca_sku_dim channel mapping failed, using fallback:', mapErr.message);
            // Fallback: classify by known platform names
            const quickcommPlatforms = ['blinkit', 'zepto', 'instamart', 'swiggy instamart', 'swiggy'];
            allMsPlatforms.forEach(p => {
                const lower = p.toLowerCase();
                const isQuickcomm = quickcommPlatforms.some(qc => lower.includes(qc));
                const ch = isQuickcomm ? 'Quickcomm' : 'Ecommerce';
                platformChannelMap.set(lower, ch);
                channelSet.add(ch);
            });
        }

        // 3. Filter platforms by selected channel (if any)
        let filteredPlatforms = allMsPlatforms;
        if (channelFilter && channelFilter !== 'All') {
            filteredPlatforms = allMsPlatforms.filter(p => {
                const ch = platformChannelMap.get(p.toLowerCase());
                if (!ch) return false;
                return ch.toLowerCase() === channelFilter.toLowerCase();
            });
            // If no platforms matched, fall back to all (don't return empty)
            if (filteredPlatforms.length === 0) filteredPlatforms = allMsPlatforms;
        }

        // 4. Build conditions for category/location queries based on filtered platforms
        let platformCond = '';
        if (filteredPlatforms.length > 0 && filteredPlatforms.length < allMsPlatforms.length) {
            platformCond = `AND platform IN (${filteredPlatforms.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // 5. Categories from rb_ms_olap (filtered by channel's platforms)
        const categoryQuery = `
            SELECT DISTINCT category 
            FROM rb_ms_olap 
            WHERE category IS NOT NULL AND category != '' 
            ${platformCond}
            ORDER BY category
        `;
        
        // 6. Locations from rb_ms_olap (filtered by channel's platforms)
        const locationQuery = `
            SELECT DISTINCT location 
            FROM rb_ms_olap 
            WHERE location IS NOT NULL AND location != '' 
            ${platformCond}
            ORDER BY location
        `;

        // 7. Platform metadata (icons) - source from rb_platform for the filtered platforms
        let platformMetadata = [];
        try {
            const tableExists = await queryClickHouse("EXISTS TABLE rb_platform");
            let visualsMap = new Map();
            if (tableExists && tableExists[0]?.result === 1) {
                const visuals = await queryClickHouse(
                    "SELECT DISTINCT pf_name, platform_description FROM rb_platform WHERE status = 1"
                );
                visuals.forEach(v => {
                    if (v.pf_name && v.platform_description) {
                        visualsMap.set(v.pf_name.toLowerCase().trim(), v.platform_description);
                    }
                });
            }

            const fallbackLogos = {
                'zepto': 'https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png',
                'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg',
                'swiggy': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp',
                'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
                'flipkart': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Flipkart-logo.png',
                'instamart': '/instamart.jpeg',
                'swiggy instamart': '/instamart.jpeg',
            };

            platformMetadata = filteredPlatforms.map(pfName => {
                const key = pfName.toLowerCase().trim();
                const dbImage = visualsMap.get(key);
                const image = dbImage || fallbackLogos[key] || null;
                return { pf_name: pfName, platform_description: image };
            });
        } catch (metaErr) {
            console.warn('[MarketShareTopFilterOptions] Platform metadata fetch failed:', metaErr.message);
            platformMetadata = filteredPlatforms.map(pfName => ({ pf_name: pfName, platform_description: null }));
        }

        const [categoryResults, locationResults] = await Promise.all([
            queryClickHouse(categoryQuery),
            queryClickHouse(locationQuery)
        ]);

        return {
            platforms: filteredPlatforms,
            categories: categoryResults.map(r => r.category),
            locations: locationResults.map(r => r.location),
            channels: Array.from(channelSet).sort(),
            platformMetadata
        };
    } catch (error) {
        console.error('[MarketShareTopFilterOptions] Error:', error.message);
        return { platforms: [], categories: [], channels: [], locations: [], platformMetadata: [] };
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

/**
 * Get Market Share Drilldown (Hierarchical)
 * Hierarchy: group_brand -> brand -> item_name
 */
export const getMarketShareDrilldown = async (start, end, platformFilter, categoryFilter, locationFilter, compStart = null, compEnd = null) => {
    try {
        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            platformCond = `AND platform IN (${platformArr.map(p => `'${p.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All') && !locationArr.includes('All India')) {
            locationCond = `AND lower(location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            categoryCond = `AND category IN (${categoryArr.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');

        const baseCond = `${platformCond} ${locationCond} ${categoryCond}`;

        // 1. Query for the full nested data at once
        const query = `
            SELECT 
                group_brand,
                brand,
                item_name,
                AVG(toFloat64OrZero(toString(nation_level_market_share))) as share,
                AVG(toFloat64OrZero(toString(mrp))) as mrp
            FROM rb_brand_ms
            WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            AND group_brand != '' AND brand != '' AND item_name != ''
            GROUP BY group_brand, brand, item_name
            ORDER BY group_brand, brand, item_name
        `;

        const results = await queryClickHouse(query);

        // 2. Build hierarchical tree
        const tree = [];
        const groupMap = new Map();

        results.forEach(row => {
            const groupKey = row.group_brand;
            const brandKey = row.brand;

            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    id: `group-${groupKey}`,
                    label: groupKey,
                    level: 'Brand',
                    metrics: { share: 0, mrp: 0, count: 0 },
                    children: new Map()
                });
                tree.push(groupMap.get(groupKey));
            }

            const group = groupMap.get(groupKey);
            if (!group.children.has(brandKey)) {
                group.children.set(brandKey, {
                    id: `brand-${groupKey}-${brandKey}`,
                    label: brandKey,
                    level: 'Sub Brand',
                    metrics: { share: 0, mrp: 0, count: 0 },
                    children: []
                });
            }

            const brand = group.children.get(brandKey);
            const sku = {
                id: `sku-${row.item_name}-${row.brand}`,
                label: row.item_name,
                level: 'SKU',
                metrics: {
                    share: parseFloat(parseFloat(row.share || 0).toFixed(2)),
                    mrp: parseFloat(parseFloat(row.mrp || 0).toFixed(2))
                }
            };

            brand.children.push(sku);

            // Aggregate values for averages
            brand.metrics.share += parseFloat(row.share || 0);
            brand.metrics.mrp += parseFloat(row.mrp || 0);
            brand.metrics.count += 1;

            group.metrics.share += parseFloat(row.share || 0);
            group.metrics.mrp += parseFloat(row.mrp || 0);
            group.metrics.count += 1;
        });

        // 3. Finalize averages
        return tree.map(group => {
            group.metrics.share = parseFloat((group.metrics.share / group.metrics.count).toFixed(2));
            group.metrics.mrp = parseFloat((group.metrics.mrp / group.metrics.count).toFixed(2));
            delete group.metrics.count;

            group.children = Array.from(group.children.values()).map(brand => {
                brand.metrics.share = parseFloat((brand.metrics.share / brand.metrics.count).toFixed(2));
                brand.metrics.mrp = parseFloat((brand.metrics.mrp / brand.metrics.count).toFixed(2));
                delete brand.metrics.count;
                return brand;
            });

            return group;
        });

    } catch (error) {
        console.error('[MarketShareDrilldown] Error:', error.message);
        return [];
    }
};
/**
 * Get the latest available date in rb_ms_olap
 */
export const getMarketShareLatestDate = async () => {
    try {
        const query = `SELECT MAX(toDate(created_on)) as maxDate FROM rb_ms_olap`;
        const result = await queryClickHouse(query);
        const maxDateStr = result?.[0]?.maxDate;
        const maxDate = maxDateStr ? dayjs(maxDateStr) : dayjs();
        
        return {
            available: !!maxDateStr,
            maxDate: maxDate.format('YYYY-MM-DD'),
            defaultEndDate: maxDate.format('YYYY-MM-DD'),
            defaultStartDate: maxDate.startOf('month').format('YYYY-MM-DD')
        };
    } catch (error) {
        console.error('[getMarketShareLatestDate] Error:', error.message);
        return {
            available: false,
            maxDate: dayjs().format('YYYY-MM-DD'),
            defaultEndDate: dayjs().format('YYYY-MM-DD'),
            defaultStartDate: dayjs().startOf('month').format('YYYY-MM-DD')
        };
    }
};
