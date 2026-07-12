/**
 * ECP by City Service
 * Provides ECP and Discount data grouped by City and Brand
 */

import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

// Helper to escape string for SQL
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

/**
 * Helper to parse multiselect filter values
 */
const parseMultiSelectFilter = (value) => {
    if (!value || value === 'All') return null;
    if (Array.isArray(value)) {
        const filtered = value.filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    if (typeof value === 'string' && value.includes(',')) {
        const filtered = value.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    return [value];
};

/**
 * Helper to build SQL IN clause for multiselect
 */
const buildInClause = (column, values) => {
    if (!values || values.length === 0) return null;
    const escaped = values.map(v => `'${escapeStr(v)}'`).join(',');
    return `${column} IN (${escaped})`;
};

/**
 * Get ECP and Discount by City and Brand
 * @param {Object} filters - { platform, startDate, endDate, city, brand }
 * @returns {Object} { success, data: [...], filters: {...} }
 */
async function getEcpByCity(filters = {}) {
    console.log('[EcpByCityService] getEcpByCity called with filters:', filters);

    try {
        const dbName = getCurrentDbName();
        const isMars = dbName === 'mars';
        const gramCol = isMars ? "''" : "s.gram";
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

        let whereConditions = [
            `p.DATE BETWEEN '${startDate}' AND '${endDate}'`,
            "p.Brand IS NOT NULL",
            "p.Location IS NOT NULL"
        ];

        const platforms = parseMultiSelectFilter(filters.platform);
        if (platforms) {
            whereConditions.push(buildInClause('p.Platform', platforms));
        }

        const cities = parseMultiSelectFilter(filters.city);
        if (cities) {
            whereConditions.push(buildInClause('p.Location', cities));
        }

        const brands = parseMultiSelectFilter(filters.brand);

        const mslArr = parseMultiSelectFilter(filters.msl);
        if (mslArr) {
            const escaped = mslArr.map(m => `'${escapeStr(m)}'`).join(',');
            whereConditions.push(`toString(p.msl) IN (${escaped})`);
        }

        const whereClause = whereConditions.join(' AND ');

        const query = `
        SELECT
            p.Location as city,
            p.Brand as brand,
            p.Platform as platform,
            ROUND(AVG(CASE WHEN p.Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE NULL END), 1) as avg_our_ecp,
            ROUND(AVG(CASE WHEN p.Comp_flag = '1' THEN ifNull(toFloat64OrZero(toString(p.Selling_Price)), 0) ELSE NULL END), 1) as avg_comp_ecp,
            any(${gramCol}) as ml
        FROM rb_pdp_olap p
        LEFT JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
        WHERE ${whereClause}
        GROUP BY city, brand, platform
        ORDER BY city, brand, platform
        LIMIT 2000
        `;

        console.log('[EcpByCityService] Executing query...');
        const results = await queryClickHouse(query);
        console.log('[EcpByCityService] Query returned', results.length, 'rows');

        // Group by City
        const cityMap = {};
        results.forEach(row => {
            // Only process brand if it's in the requested brands (or All)
            if (brands && !brands.includes(row.brand)) return;

            if (!cityMap[row.city]) {
                cityMap[row.city] = {
                    city: row.city,
                    totals: {},
                    brandsMap: {}
                };
            }

            const cityData = cityMap[row.city];
            const platformKey = (row.platform || 'Unknown').toLowerCase();

            const ourPrice = parseFloat(row.avg_our_ecp) || 0;
            const compPrice = parseFloat(row.avg_comp_ecp) || 0;
            const rpi = compPrice > 0 ? parseFloat((ourPrice / compPrice).toFixed(2)) : 1.0;

            // Platform totals for city
            if (!cityData.totals[platformKey]) {
                cityData.totals[platformKey] = { ecp: 0, rpiSum: 0, count: 0 };
            }
            const pTot = cityData.totals[platformKey];
            pTot.ecp += ourPrice;
            pTot.rpiSum += rpi;
            pTot.count += 1;

            // Brand data for city
            if (!cityData.brandsMap[row.brand]) {
                cityData.brandsMap[row.brand] = {
                    name: row.brand,
                    ml: row.ml || '—',
                    total: { ecp: 0, rpiSum: 0, count: 0 }
                };
            }

            const brandData = cityData.brandsMap[row.brand];
            brandData[platformKey] = {
                ecp: ourPrice,
                rpi: rpi
            };

            brandData.total.ecp += ourPrice;
            brandData.total.rpiSum += rpi;
            brandData.total.count += 1;
        });

        // Final formatting
        const data = Object.values(cityMap).map(city => {
            // Average the platform totals
            Object.keys(city.totals).forEach(pk => {
                const t = city.totals[pk];
                t.ecp = parseFloat((t.ecp / t.count).toFixed(1));
                t.rpi = parseFloat((t.rpiSum / t.count).toFixed(2));
                delete t.rpiSum;
                delete t.count;
            });

            // Overall total for city
            const allPlatformValues = Object.values(city.totals);
            city.totals.total = {
                ecp: allPlatformValues.length > 0 ? parseFloat((allPlatformValues.reduce((sum, v) => sum + v.ecp, 0) / allPlatformValues.length).toFixed(1)) : 0,
                rpi: allPlatformValues.length > 0 ? parseFloat((allPlatformValues.reduce((sum, v) => sum + v.rpi, 0) / allPlatformValues.length).toFixed(2)) : 0
            };

            // Format brands array
            const brands = Object.values(city.brandsMap).map(brand => {
                const t = brand.total;
                t.ecp = parseFloat((t.ecp / t.count).toFixed(1));
                t.discount = parseFloat((t.discount / t.count).toFixed(1));
                t.rpi = parseFloat((t.rpiSum / t.count).toFixed(2));
                delete t.rpiSum;
                delete t.count;
                return brand;
            });

            return {
                city: city.city,
                totals: city.totals,
                brands: brands
            };
        });

        console.log('[EcpByCityService] Returning', data.length, 'cities');
        return {
            success: true,
            data,
            filters: {
                startDate,
                endDate
            }
        };
    } catch (error) {
        console.error('[EcpByCityService] Error:', error);
        return { success: false, data: [], error: error.message };
    }
}

export default {
    getEcpByCity
};
