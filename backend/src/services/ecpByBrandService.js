/**
 * ECP by Brand Service
 * Provides ECP and MRP data grouped by Brand for the Pricing Analysis page
 * ECP Per Unit = ECP / avg gram (from rb_sku_platform.quantity)
 */

import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';


/**
 * Parse quantity string to extract numeric gram value
 * Examples: "100", "100g", "100 g", "100ml", etc.
 * @param {string} quantityStr - Quantity string
 * @returns {number} Parsed numeric value
 */
function parseQuantity(quantityStr) {
    if (!quantityStr || typeof quantityStr !== 'string') return 0;

    // Extract first number from string
    const match = quantityStr.match(/(\d+(?:\.\d+)?)/);
    if (match) {
        return parseFloat(match[1]) || 0;
    }
    return 0;
}

/**
 * Get ECP by Brand data with ECP Per Unit calculated from rb_sku_platform.quantity
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
            `p.DATE BETWEEN '${startDate}' AND '${endDate}'`,
            "p.Brand IS NOT NULL"
        ];

        // Platform filter
        if (platform && platform !== 'All') {
            whereConditions.push(`LOWER(p.Platform) = LOWER('${platform}')`);
        }

        if (location && location !== 'All') {
            whereConditions.push(`LOWER(p.Location) = LOWER('${location}')`);
        }

        const whereClause = whereConditions.join(' AND ');

        // SQL query to calculate MRP, ECP, and avg gram by Brand
        // Join rb_pdp_olap (p) with rb_sku_platform (s) on Web_Pid = web_pid
        // Only include quantity values that are valid (not null/empty and > 0)
        const query = `
            SELECT
                p.Brand,
                ROUND(
                    SUM(CASE WHEN p.MRP IS NOT NULL AND toFloat64(p.MRP) > 0 THEN toFloat64(p.MRP) ELSE 0 END)
                    / NULLIF(COUNT(CASE WHEN p.MRP IS NOT NULL AND toFloat64(p.MRP) > 0 THEN 1 END), 0),
                    0
                ) AS mrp,
                ROUND(
                    SUM(CASE WHEN p.Selling_Price IS NOT NULL AND toFloat64(p.Selling_Price) > 0 THEN toFloat64(p.Selling_Price) ELSE 0 END)
                    / NULLIF(COUNT(CASE WHEN p.Selling_Price IS NOT NULL AND toFloat64(p.Selling_Price) > 0 THEN 1 END), 0),
                    0
                ) AS ecp,
                AVG(
                    CASE 
                        WHEN s.quantity IS NOT NULL 
                        AND s.quantity != '' 
                        AND s.quantity != '0' 
                        AND isFinite(toFloat64(s.quantity))
                        AND toFloat64(s.quantity) > 0 
                        THEN toFloat64(s.quantity) 
                        ELSE NULL 
                    END
                ) AS avg_gram
            FROM rb_pdp_olap p
            LEFT JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
            WHERE ${whereClause}
            GROUP BY p.Brand
            HAVING mrp IS NOT NULL OR ecp IS NOT NULL
            ORDER BY p.Brand
        `;

        console.log('[EcpByBrandService] Executing ECP by Brand query with gram join...');
        const queryStart = Date.now();

        const results = await queryClickHouse(query);

        console.log(`[EcpByBrandService] Query completed in ${Date.now() - queryStart}ms, found ${results?.length || 0} results`);

        // Transform results and calculate ECP Per Unit
        const data = (results || []).map((row, index) => {
            const mrp = parseFloat(row.mrp) || 0;
            const ecp = parseFloat(row.ecp) || 0;
            const avgGram = parseFloat(row.avg_gram) || 0;

            // ECP Per Unit = ECP / avg gram (price per gram)
            // Only calculate if avgGram is valid (> 0)
            const ecpPerUnit = avgGram > 0 ? ecp / avgGram : 0;

            return {
                id: index + 1,
                brand: row.Brand,
                mrp: Math.round(mrp),
                ecp: Math.round(ecp),
                ecpPerUnit: parseFloat(ecpPerUnit.toFixed(2)),
                rpi: 0  // RPI placeholder - to be implemented later
            };
        });

        // Sort by brand name
        data.sort((a, b) => a.brand.localeCompare(b.brand));

        // Log some samples for debugging
        const samples = data.slice(0, 5).map(d => ({
            brand: d.brand,
            ecp: d.ecp,
            ecpPerUnit: d.ecpPerUnit
        }));
        console.log('[EcpByBrandService] Sample ECP Per Unit values:', samples);

        console.log(`[EcpByBrandService] Returning ${data.length} ECP by Brand records`);

        return {
            success: true,
            data,
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
