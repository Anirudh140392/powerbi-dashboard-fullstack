import { Op } from 'sequelize';
import RbPdpOlap from '../models/RbPdpOlap.js';
import RbSkuPlatform from '../models/RbSkuPlatform.js';
import sequelize from '../config/db.js';

/**
 * Map metric keys to database column names
 */
const METRIC_COLUMN_MAP = {
    'inorganic_sales': 'Ad_sales',
    'offtake': 'Sales',
    'ad_spend': 'Ad_Spend',
    'roas': 'ROAS',
    'qty_sold': 'Qty_Sold',
    'ad_clicks': 'Ad_Clicks',
    'ad_impressions': 'Ad_Impressions',
    'discount': 'Discount',
    'mrp': 'MRP',
    'selling_price': 'Selling_Price',
};

/**
 * Get all platforms list
 */
const PLATFORMS = ['Blinkit', 'Zepto', 'Swiggy', 'Amazon', 'Flipkart'];

/**
 * Format number to Indian currency
 */
function formatCurrency(value) {
    if (!value || value === 0) return '-';

    const num = parseFloat(value);
    if (isNaN(num)) return '-';

    // Convert to Crores
    const crores = num / 10000000;
    if (crores >= 1) {
        return `₹${crores.toFixed(2)} Cr`;
    }

    // Convert to Lakhs
    const lakhs = num / 100000;
    if (lakhs >= 1) {
        return `₹${lakhs.toFixed(2)} L`;
    }

    // Convert to Thousands
    const thousands = num / 1000;
    if (thousands >= 1) {
        return `₹${thousands.toFixed(2)} K`;
    }

    return `₹${num.toFixed(2)}`;
}

/**
 * Format number based on metric type
 */
function formatMetricValue(value, metricKey) {
    if (!value || value === 0) return '-';

    const num = parseFloat(value);
    if (isNaN(num)) return '-';

    // Currency metrics
    if (['offtake', 'inorganic_sales', 'ad_spend', 'mrp', 'selling_price'].includes(metricKey.toLowerCase())) {
        return formatCurrency(num);
    }

    // Percentage metrics
    if (['discount'].includes(metricKey.toLowerCase())) {
        return `${num.toFixed(2)}%`;
    }

    // ROAS
    if (metricKey.toLowerCase() === 'roas') {
        return `${num.toFixed(2)}x`;
    }

    // Regular numbers
    if (num >= 10000000) {
        return `${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
        return `${(num / 100000).toFixed(2)} L`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(2)} K`;
    }

    return num.toFixed(0);
}

/**
 * Get SKU metrics data based on selected metric
 * @param {string} metricKey - The selected metric key
 * @param {Object} filters - Optional filters (dateFrom, dateTo, brand, location, etc.)
 * @returns {Promise<Array>} Array of SKU data with metric values per platform
 */
export async function getSkuMetrics(metricKey, filters = {}) {
    try {
        // Normalize metric key (remove spaces, lowercase, replace with underscore)
        const normalizedMetricKey = metricKey.toLowerCase().replace(/\s+/g, '_');

        // Get the database column name for this metric
        const dbColumn = METRIC_COLUMN_MAP[normalizedMetricKey];

        if (!dbColumn) {
            console.warn(`Unknown metric key: ${metricKey}. Using default (Sales).`);
            // Default to Sales column
            const defaultColumn = 'Sales';
            return await fetchSkuData(defaultColumn, normalizedMetricKey, filters);
        }

        return await fetchSkuData(dbColumn, normalizedMetricKey, filters);
    } catch (error) {
        console.error('Error in getSkuMetrics:', error);
        return [];
    }
}

/**
 * Fetch and aggregate SKU data from database
 */
async function fetchSkuData(dbColumn, metricKey, filters) {
    try {
        console.log('=== fetchSkuData called ===');
        console.log('dbColumn:', dbColumn);
        console.log('metricKey:', metricKey);
        console.log('filters:', filters);

        // Build WHERE conditions for the SQL query
        let whereConditions = [];
        let replacements = {};

        if (filters.dateFrom && filters.dateTo) {
            whereConditions.push('olap.DATE BETWEEN :dateFrom AND :dateTo');
            replacements.dateFrom = filters.dateFrom;
            replacements.dateTo = filters.dateTo;
        }

        if (filters.brand) {
            // Filter by brand_name from rb_sku_platform table
            whereConditions.push('sku.brand_name = :brand');
            replacements.brand = filters.brand;
        }

        if (filters.location) {
            whereConditions.push('olap.Location = :location');
            replacements.location = filters.location;
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        console.log('whereClause:', whereClause);
        console.log('replacements:', replacements);

        // Use raw SQL query to join rb_pdp_olap with rb_sku_platform
        // Join on Web_Pid from rb_pdp_olap and web_pid from rb_sku_platform
        const query = `
            SELECT 
                sku.sku_name AS sku_name,
                olap.Platform AS platform,
                SUM(olap.${dbColumn}) AS total_value
            FROM rb_pdp_olap AS olap
            INNER JOIN rb_sku_platform AS sku ON olap.Web_Pid = sku.web_pid
            ${whereClause}
            GROUP BY sku.sku_name, olap.Platform
            LIMIT 100
        `;

        console.log('Executing SQL query:', query);

        const results = await sequelize.query(query, {
            replacements,
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`Found ${results.length} results from database`);
        console.log('First few results:', JSON.stringify(results.slice(0, 3), null, 2));

        // Group by SKU name
        const skuMap = {};

        results.forEach(row => {
            const skuName = row.sku_name;
            const platform = row.platform;
            const value = parseFloat(row.total_value) || 0;

            if (!skuMap[skuName]) {
                skuMap[skuName] = {
                    name: skuName,
                    all: { value: 0 },
                    blinkit: { value: 0 },
                    zepto: { value: 0 },
                    swiggy: { value: 0 },
                    amazon: { value: 0 },
                    flipkart: { value: 0 }
                };
            }

            // Add to platform-specific value
            const platformKey = platform.toLowerCase();
            if (skuMap[skuName][platformKey]) {
                skuMap[skuName][platformKey].value = value;
            }

            // Add to ALL total
            skuMap[skuName].all.value += value;
        });

        console.log(`Grouped into ${Object.keys(skuMap).length} SKUs`);

        // Format the values
        const formattedResults = Object.values(skuMap).map(sku => {
            const formatted = {
                name: sku.name
            };

            // Format each platform value
            ['all', 'blinkit', 'zepto', 'swiggy', 'amazon', 'flipkart'].forEach(platform => {
                formatted[platform] = {
                    value: formatMetricValue(sku[platform].value, metricKey),
                    // Placeholder for change - you can calculate this if you have historical data
                    change: '-'
                };
            });

            return formatted;
        });

        console.log('Formatted results count:', formattedResults.length);
        console.log('First formatted result:', JSON.stringify(formattedResults[0], null, 2));

        return formattedResults;
    } catch (error) {
        console.error('Error fetching SKU data:', error);
        console.error('Error stack:', error.stack);
        return [];
    }
}

export default {
    getSkuMetrics
};
