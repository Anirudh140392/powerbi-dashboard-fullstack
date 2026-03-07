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

/**
 * Shared Market Share Calculation Helper
 * Uses rb_brand_ms table and nation_level_market_share logic.
 * Categorical logic: maxIf for Chocolates, Gift Pack, GMFC.
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

        let col = 'combined_ms';
        if (categoryArr && categoryArr.length === 1) {
            const c = categoryArr[0];
            if (c === 'Chocolates' || c === 'Chocolates (Non Gifting)') col = 'chocolates_ms';
            else if (c === 'Chocolate Gift Pack' || c === 'Chocolates (Gifting)') col = 'gift_pack_ms';
            else if (c === 'GMFC') col = 'gmfc_ms';
        }

        const query = `
            SELECT AVG(${col}) as avg_market_share
            FROM (
                SELECT created_on, brand,
                    maxIf(brand_ms, category = 'Chocolates') AS chocolates_ms,
                    maxIf(brand_ms, category = 'Chocolate Gift Pack') AS gift_pack_ms,
                    maxIf(brand_ms, category = 'GMFC') AS gmfc_ms,
                    avg(brand_ms) AS combined_ms
                FROM (
                    SELECT toDate(created_on) AS created_on, category, brand,
                        MAX(nation_level_market_share) AS brand_ms
                    FROM rb_brand_ms
                    WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                    ${platformCond}
                    ${locationCond}
                    AND brand IN (${brandsSql})
                    GROUP BY created_on, category, brand
                ) AS cat_level
                GROUP BY created_on, brand
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

        let col = 'combined_ms';
        if (categoryArr && categoryArr.length === 1) {
            const c = categoryArr[0];
            if (c === 'Chocolates' || c === 'Chocolates (Non Gifting)') col = 'chocolates_ms';
            else if (c === 'Chocolate Gift Pack' || c === 'Chocolates (Gifting)') col = 'gift_pack_ms';
            else if (c === 'GMFC') col = 'gmfc_ms';
        }

        const query = `
            SELECT formatDateTime(toDate(created_on), '%Y-%m-01') as month_date,
                AVG(${col}) as avg_market_share
            FROM (
                SELECT created_on, brand,
                    maxIf(brand_ms, category = 'Chocolates') AS chocolates_ms,
                    maxIf(brand_ms, category = 'Chocolate Gift Pack') AS gift_pack_ms,
                    maxIf(brand_ms, category = 'GMFC') AS gmfc_ms,
                    avg(brand_ms) AS combined_ms
                FROM (
                    SELECT toDate(created_on) AS created_on, category, brand,
                        MAX(nation_level_market_share) AS brand_ms
                    FROM rb_brand_ms
                    WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                    ${platformCond}
                    ${locationCond}
                    AND brand IN (${brandsSql})
                    GROUP BY created_on, category, brand
                ) AS cat_level
                GROUP BY created_on, brand
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

        let col = 'combined_ms';
        if (categoryArr && categoryArr.length === 1) {
            const c = categoryArr[0];
            if (c === 'Chocolates' || c === 'Chocolates (Non Gifting)') col = 'chocolates_ms';
            else if (c === 'Chocolate Gift Pack' || c === 'Chocolates (Gifting)') col = 'gift_pack_ms';
            else if (c === 'GMFC') col = 'gmfc_ms';
        }

        const query = `
            SELECT brand,
                AVG(${col}) as avg_market_share
            FROM (
                SELECT created_on, brand,
                    maxIf(brand_ms, category = 'Chocolates') AS chocolates_ms,
                    maxIf(brand_ms, category = 'Chocolate Gift Pack') AS gift_pack_ms,
                    maxIf(brand_ms, category = 'GMFC') AS gmfc_ms,
                    avg(brand_ms) AS combined_ms
                FROM (
                    SELECT toDate(created_on) AS created_on, category, brand,
                        MAX(nation_level_market_share) AS brand_ms
                    FROM rb_brand_ms
                    WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                    ${platformCond}
                    ${locationCond}
                    AND brand IN (${brandsSql})
                    GROUP BY created_on, category, brand
                ) AS cat_level
                GROUP BY created_on, brand
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

        let col = 'combined_ms';
        if (categoryArr && categoryArr.length === 1) {
            const c = categoryArr[0];
            if (c === 'Chocolates' || c === 'Chocolates (Non Gifting)') col = 'chocolates_ms';
            else if (c === 'Chocolate Gift Pack' || c === 'Chocolates (Gifting)') col = 'gift_pack_ms';
            else if (c === 'GMFC') col = 'gmfc_ms';
        }

        let groupFormat = '%Y-%m-%d';
        if (timeStep === 'Monthly') groupFormat = '%Y-%m-01';

        let groupExpr = `formatDateTime(toDate(created_on), '${groupFormat}')`;
        if (timeStep === 'Weekly') groupExpr = `toYearWeek(toDate(created_on), 1)`;

        const query = `
            SELECT ${groupExpr} as date_group,
                AVG(${col}) as avg_market_share
            FROM (
                SELECT created_on, brand,
                    maxIf(brand_ms, category = 'Chocolates') AS chocolates_ms,
                    maxIf(brand_ms, category = 'Chocolate Gift Pack') AS gift_pack_ms,
                    maxIf(brand_ms, category = 'GMFC') AS gmfc_ms,
                    avg(brand_ms) AS combined_ms
                FROM (
                    SELECT toDate(created_on) AS created_on, category, brand,
                        MAX(nation_level_market_share) AS brand_ms
                    FROM rb_brand_ms
                    WHERE toDate(created_on) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'
                    ${platformCond}
                    ${locationCond}
                    AND brand IN (${brandsSql})
                    GROUP BY created_on, category, brand
                ) AS cat_level
                GROUP BY created_on, brand
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
