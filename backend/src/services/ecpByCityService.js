/**
 * ECP by City Service
 * Provides ECP and Discount data grouped by City and Brand
 */

import { queryClickHouse } from '../config/clickhouse.js';
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
        if (brands) {
            whereConditions.push(buildInClause('p.Brand', brands));
        }

        const whereClause = whereConditions.join(' AND ');

        const query = `
        SELECT
            p.Location as city,
            p.Brand as brand,
            p.Platform as platform,
            ROUND(AVG(toFloat64OrZero(toString(p.Selling_Price))), 1) as ecp,
            ROUND(AVG(toFloat64OrZero(toString(p.MRP))), 1) as mrp,
            ROUND(AVG(toFloat64OrZero(toString(p.Discount))), 1) as discount,
            ROUND(AVG(toFloat64OrZero(toString(p.Selling_Price))) / NULLIF(AVG(toFloat64OrZero(toString(p.MRP))), 0), 2) as rpi,
            any(s.gram) as ml
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
            if (!cityMap[row.city]) {
                cityMap[row.city] = {
                    city: row.city,
                    totals: {},
                    brandsMap: {}
                };
            }

            const cityData = cityMap[row.city];
            const platformKey = (row.platform || 'Unknown').toLowerCase();

            // Platform totals for city
            if (!cityData.totals[platformKey]) {
                cityData.totals[platformKey] = { ecp: 0, discount: 0, rpiSum: 0, count: 0 };
            }
            const pTot = cityData.totals[platformKey];
            pTot.ecp += row.ecp;
            pTot.discount += row.discount;
            pTot.rpiSum += row.rpi || 0;
            pTot.count += 1;

            // Brand data for city
            if (!cityData.brandsMap[row.brand]) {
                cityData.brandsMap[row.brand] = {
                    name: row.brand,
                    ml: row.ml || '—',
                    total: { ecp: 0, discount: 0, rpiSum: 0, count: 0 }
                };
            }

            const brandData = cityData.brandsMap[row.brand];
            brandData[platformKey] = {
                ecp: row.ecp,
                discount: row.discount,
                rpi: row.rpi || 0
            };

            brandData.total.ecp += row.ecp;
            brandData.total.discount += row.discount;
            brandData.total.rpiSum += row.rpi || 0;
            brandData.total.count += 1;
        });

        // Final formatting
        const data = Object.values(cityMap).map(city => {
            // Average the platform totals
            Object.keys(city.totals).forEach(pk => {
                const t = city.totals[pk];
                t.ecp = parseFloat((t.ecp / t.count).toFixed(1));
                t.discount = parseFloat((t.discount / t.count).toFixed(1));
                t.rpi = parseFloat((t.rpiSum / t.count).toFixed(2));
                delete t.rpiSum;
                delete t.count;
            });

            // Overall total for city
            const allPlatformValues = Object.values(city.totals);
            city.totals.total = {
                ecp: parseFloat((allPlatformValues.reduce((sum, v) => sum + v.ecp, 0) / allPlatformValues.length).toFixed(1)),
                discount: parseFloat((allPlatformValues.reduce((sum, v) => sum + v.discount, 0) / allPlatformValues.length).toFixed(1)),
                rpi: parseFloat((allPlatformValues.reduce((sum, v) => sum + v.rpi, 0) / allPlatformValues.length).toFixed(2))
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
