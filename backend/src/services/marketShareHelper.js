import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

/**
 * Normalizes multi-value filters from frontend
 * Handles: null, string, comma-separated string, array
 */
export const normalizeFilterArray = (value) => {
    if (!value || value === 'All' || value === 'undefined') return [];
    if (Array.isArray(value)) return value.filter(v => v && v !== 'All' && v !== 'undefined');
    if (typeof value === 'string') {
        return value.split(',').map(s => s.trim()).filter(s => s && s !== 'All' && s !== 'undefined');
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

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `Platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND Location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // If brandFilter is provided, use it. Otherwise use the hardcoded Mars brands.
        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            brandsToQuery = [
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', "Wrigley's Doublemint"
            ];
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            categoryCond = `AND category IN (${categoryArr.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const query = `
            SELECT AVG(avg_nation) as avg_market_share
            FROM (
                SELECT AVG(nation_level_market_share) as avg_nation
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                ${platformCond}
                ${locationCond}
                ${categoryCond}
                AND brand IN (${brandsSql})
                GROUP BY category, sub_category, group_brand
            )
        `;
        const result = await queryClickHouse(query);
        return parseFloat(result?.[0]?.avg_market_share || 0);
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

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `Platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND Location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            brandsToQuery = [
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', "Wrigley's Doublemint"
            ];
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            categoryCond = `AND category IN (${categoryArr.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const query = `
            SELECT formatDateTime(toDate(month_date_val), '%Y-%m-01') as month_date,
                   AVG(avg_nation) as avg_market_share
            FROM (
                SELECT toDate(created_on) as month_date_val,
                       AVG(nation_level_market_share) as avg_nation
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                ${platformCond}
                ${locationCond}
                ${categoryCond}
                AND brand IN (${brandsSql})
                GROUP BY month_date_val, category, sub_category, group_brand
            )
            GROUP BY month_date
        `;
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

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `Platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND Location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            brandsToQuery = [
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', "Wrigley's Doublemint"
            ];
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            categoryCond = `AND category IN (${categoryArr.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // Keep it grouped by brand for the final output
        const query = `
            SELECT brand,
                   AVG(avg_nation) as avg_market_share
            FROM (
                SELECT brand,
                       AVG(nation_level_market_share) as avg_nation
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                ${platformCond}
                ${locationCond}
                ${categoryCond}
                AND brand IN (${brandsSql})
                GROUP BY brand, category, sub_category, group_brand
            )
            GROUP BY brand
        `;
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

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `Platform LIKE '%${p.charAt(0).toUpperCase() + p.slice(1)}%'`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND Location IN (${locationArr.map(l => `'${l.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let brandsToQuery = [];
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandsToQuery = brandArr;
        } else {
            brandsToQuery = [
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', "Wrigley's Doublemint"
            ];
        }
        const brandsSql = brandsToQuery.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            categoryCond = `AND category IN (${categoryArr.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        let groupFormat = '%Y-%m-%d';
        if (timeStep === 'Monthly') groupFormat = '%Y-%m-01';

        let groupExpr = `formatDateTime(toDate(created_on_val), '${groupFormat}')`;
        if (timeStep === 'Weekly') groupExpr = `toYearWeek(toDate(created_on_val), 1)`;

        const query = `
            SELECT ${groupExpr} as date_group,
                   AVG(avg_nation) as avg_market_share
            FROM (
                SELECT toDate(created_on) as created_on_val,
                       AVG(nation_level_market_share) as avg_nation
                FROM rb_brand_ms
                WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                ${platformCond}
                ${locationCond}
                ${categoryCond}
                AND brand IN (${brandsSql})
                GROUP BY created_on_val, category, sub_category, group_brand
            )
            GROUP BY date_group
        `;
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
