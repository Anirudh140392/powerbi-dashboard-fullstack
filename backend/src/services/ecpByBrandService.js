/**
 * ECP by Brand Service
 * Provides ECP and MRP data grouped by Brand for the Pricing Analysis page
 */

import sequelize from '../config/db.js';
import dayjs from 'dayjs';

/**
 * Parse weight string like "225 ml X 3" or "30 g X 2" to get total weight
 * @param {string} weightStr - Weight string in format "value unit X quantity"
 * @returns {number} Total weight (value * quantity)
 */
function parseWeight(weightStr) {
    if (!weightStr || typeof weightStr !== 'string') return 0;

    // Match pattern: number, optional unit (ml/g/kg/L etc), X, number
    // Examples: "225 ml X 3", "30 g X 2", "400 g X 2", "20 g X 4"
    const match = weightStr.match(/(\d+(?:\.\d+)?)\s*(?:ml|g|kg|l|L|ML|G|KG)?\s*[Xx]\s*(\d+)/i);

    if (match) {
        const value = parseFloat(match[1]) || 0;
        const quantity = parseFloat(match[2]) || 1;
        return value * quantity;
    }

    // Fallback: try to extract just the first number
    const simpleMatch = weightStr.match(/(\d+(?:\.\d+)?)/);
    if (simpleMatch) {
        return parseFloat(simpleMatch[1]) || 0;
    }

    return 0;
}

/**
 * Get ECP by Brand data
 * @param {Object} filters - { platform, location, startDate, endDate }
 * @returns {Object} { data: [...], filters: {...} }
 */
async function getEcpByBrand(filters = {}) {
    try {
        console.log('[EcpByBrandService] getEcpByBrand called with filters:', filters);

        // Date range for calculation
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

        const platform = filters.platform || null;
        const location = filters.location || null;

        // Build dynamic WHERE conditions
        let whereConditions = [
            "DATE BETWEEN :startDate AND :endDate",
            "Brand IS NOT NULL"
        ];
        const replacements = {
            startDate,
            endDate
        };

        // Platform filter - required for this endpoint
        if (platform && platform !== 'All') {
            whereConditions.push("LOWER(Platform) = LOWER(:platform)");
            replacements.platform = platform;
        }

        if (location && location !== 'All') {
            whereConditions.push("LOWER(Location) = LOWER(:location)");
            replacements.location = location;
        }

        const whereClause = whereConditions.join(' AND ');

        // SQL query to calculate MRP, ECP, and Weight by Brand
        const query = `
            SELECT
                Brand,
                Weight,
                ROUND(
                    SUM(CASE WHEN MRP IS NOT NULL AND MRP > 0 THEN MRP ELSE 0 END)
                    / NULLIF(COUNT(CASE WHEN MRP IS NOT NULL AND MRP > 0 THEN 1 END), 0),
                    0
                ) AS mrp,
                ROUND(
                    SUM(CASE WHEN Selling_Price IS NOT NULL AND Selling_Price > 0 THEN Selling_Price ELSE 0 END)
                    / NULLIF(COUNT(CASE WHEN Selling_Price IS NOT NULL AND Selling_Price > 0 THEN 1 END), 0),
                    0
                ) AS ecp
            FROM rb_pdp_olap
            WHERE ${whereClause}
            GROUP BY Brand, Weight
            HAVING mrp IS NOT NULL OR ecp IS NOT NULL
            ORDER BY Brand
        `;

        console.log('[EcpByBrandService] Executing ECP by Brand query...');
        const queryStart = Date.now();

        const [results] = await sequelize.query(query, { replacements });

        console.log(`[EcpByBrandService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

        // Group results by Brand and calculate average weight
        const brandMap = {};
        const sampleWeights = []; // For debugging

        (results || []).forEach(row => {
            const brand = row.Brand;
            const weight = parseWeight(row.Weight);
            const mrp = parseFloat(row.mrp) || 0;
            const ecp = parseFloat(row.ecp) || 0;

            // Log first 5 weight samples for debugging
            if (sampleWeights.length < 5 && row.Weight) {
                sampleWeights.push({ raw: row.Weight, parsed: weight });
            }

            if (!brandMap[brand]) {
                brandMap[brand] = {
                    brand,
                    totalMrp: 0,
                    totalEcp: 0,
                    totalWeight: 0,
                    count: 0
                };
            }

            brandMap[brand].totalMrp += mrp;
            brandMap[brand].totalEcp += ecp;
            brandMap[brand].totalWeight += weight;
            brandMap[brand].count += 1;
        });

        console.log('[EcpByBrandService] Sample Weight values:', sampleWeights);

        // Calculate averages and ecpPerUnit
        const data = Object.values(brandMap).map(brandData => {
            const avgMrp = brandData.count > 0 ? brandData.totalMrp / brandData.count : 0;
            const avgEcp = brandData.count > 0 ? brandData.totalEcp / brandData.count : 0;
            const avgWeight = brandData.count > 0 ? brandData.totalWeight / brandData.count : 0;

            // ecpPerUnit = ECP / avgWeight (price per gram/ml)
            const ecpPerUnit = avgWeight > 0 ? avgEcp / avgWeight : 0;

            return {
                brand: brandData.brand,
                mrp: Math.round(avgMrp),
                ecp: Math.round(avgEcp),
                ecpPerUnit: parseFloat(ecpPerUnit.toFixed(2)),
                rpi: 0  // Placeholder for now
            };
        });

        // Sort by brand name
        data.sort((a, b) => a.brand.localeCompare(b.brand));

        console.log(`[EcpByBrandService] Returning ${data.length} ECP by Brand records`);

        return {
            success: true,
            data,
            debug: { sampleWeights }, // Debugging - remove later
            filters: {
                startDate,
                endDate,
                platform: platform || 'All',
                location: location || 'All'
            },
            summary: {
                total: data.length
            }
        };

    } catch (error) {
        console.error('[EcpByBrandService] Error in getEcpByBrand:', error);
        return {
            success: false,
            data: [],
            error: error.message,
            filters: {
                startDate: filters.startDate,
                endDate: filters.endDate
            }
        };
    }
}

export default {
    getEcpByBrand
};
