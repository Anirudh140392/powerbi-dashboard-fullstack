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
    const cacheKey = generateCacheKey('pricing_ecp_by_city', filters);

    return await getCachedOrCompute(cacheKey, async () => {
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
                ROUND(AVG(toFloat64(p.Selling_Price)), 1) as ecp,
                ROUND(AVG(toFloat64(p.MRP)), 1) as mrp,
                ROUND(AVG(toFloat64(p.Discount)), 1) as discount,
                ANY(s.gram) as ml
            FROM rb_pdp_olap p
            LEFT JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
            WHERE ${whereClause}
            GROUP BY city, brand, platform
            ORDER BY city, brand, platform
            LIMIT 2000
            `;

            console.log('[EcpByCityService] Executing query...');
            const results = await queryClickHouse(query);

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
                const platformKey = row.platform.toLowerCase();

                // Platform totals for city
                if (!cityData.totals[platformKey]) {
                    cityData.totals[platformKey] = { ecp: 0, discount: 0, rpi: 1.0, count: 0 };
                }
                cityData.totals[platformKey].ecp += row.ecp;
                cityData.totals[platformKey].discount += row.discount;
                cityData.totals[platformKey].count += 1;

                // Brand data for city
                if (!cityData.brandsMap[row.brand]) {
                    cityData.brandsMap[row.brand] = {
                        name: row.brand,
                        ml: row.ml || '—',
                        total: { ecp: 0, discount: 0, rpi: 1.0, count: 0 }
                    };
                }

                const brandData = cityData.brandsMap[row.brand];
                brandData[platformKey] = {
                    ecp: row.ecp,
                    discount: row.discount,
                    rpi: 1.0 // Placeholder
                };

                brandData.total.ecp += row.ecp;
                brandData.total.discount += row.discount;
                brandData.total.count += 1;
            });

            // Final formatting
            const data = Object.values(cityMap).map(city => {
                // Average the platform totals
                Object.keys(city.totals).forEach(pk => {
                    city.totals[pk].ecp = parseFloat((city.totals[pk].ecp / city.totals[pk].count).toFixed(1));
                    city.totals[pk].discount = parseFloat((city.totals[pk].discount / city.totals[pk].count).toFixed(1));
                    delete city.totals[pk].count;
                });

                // Overall total for city
                const allPlatformValues = Object.values(city.totals);
                city.totals.total = {
                    ecp: parseFloat((allPlatformValues.reduce((sum, v) => sum + v.ecp, 0) / allPlatformValues.length).toFixed(1)),
                    discount: parseFloat((allPlatformValues.reduce((sum, v) => sum + v.discount, 0) / allPlatformValues.length).toFixed(1)),
                    rpi: 1.0
                };

                // Format brands array
                const brands = Object.values(city.brandsMap).map(brand => {
                    brand.total.ecp = parseFloat((brand.total.ecp / brand.total.count).toFixed(1));
                    brand.total.discount = parseFloat((brand.total.discount / brand.total.count).toFixed(1));
                    brand.total.rpi = 1.0;
                    delete brand.total.count;
                    return brand;
                });

                return {
                    city: city.city,
                    totals: city.totals,
                    brands: brands
                };
            });

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
    }, CACHE_TTL.ONE_HOUR);
}

export default {
    getEcpByCity
};
