import { Op, Sequelize } from 'sequelize';
import RbPdpOlap from '../models/RbPdpOlap.js';
import RbKw from '../models/RbKw.js';
import RbBrandMs from '../models/RbBrandMs.js';
import RcaSkuDim from '../models/RcaSkuDim.js';
import sequelize from '../config/db.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

/**
 * Map metric keys to database column names
 * Handles both singular and plural forms, with and without spaces
 */
const METRIC_COLUMN_MAP = {
    // Offtakes / Sales
    'offtake': 'Sales',
    'offtakes': 'Sales',

    // Inorganic Sales
    'inorganic_sales': 'Ad_sales',

    // Spend
    'spend': 'Ad_Spend',
    'ad_spend': 'Ad_Spend',

    // ROAS - Calculated dynamically as Ad_sales / Ad_Spend
    'roas': 'ROAS_CALC',

    // Quantity Sold
    'qty_sold': 'Qty_Sold',

    // Ad Clicks
    'ad_clicks': 'Ad_Clicks',

    // Ad Impressions
    'ad_impressions': 'Ad_Impressions',

    // Discount
    'discount': 'Discount',

    // MRP
    'mrp': 'MRP',

    // Selling Price
    'selling_price': 'Selling_Price',

    // Availability - Special calculation using neno_osa and deno_osa
    'availability': 'AVAILABILITY_CALC',

    // SOS (Share of Search) - Special calculation
    'sos': 'SOS_CALC',
    'share_of_search': 'SOS_CALC',

    // Market Share - Special calculation
    'market_share': 'MARKET_SHARE_CALC',

    // CTR (Click-Through Rate) - Calculated metric
    'ctr': 'CTR_CALC',
    'click_through_rate': 'CTR_CALC',

    // Conversion - Same as CTR (Ad_Clicks / Ad_Impressions * 100)
    'conversion': 'CTR_CALC',

    // CPC (Cost Per Click) - Calculated metric
    'cpc': 'CPC_CALC',
    'cost_per_click': 'CPC_CALC',

    // CPM (Cost Per Mille/Thousand) - Calculated metric
    'cpm': 'CPM_CALC',
    'cost_per_mille': 'CPM_CALC',

    // Promo My Brand - Own brand promotional data (Comp_flag = 0)
    // Calculated as: AVG((MRP - Selling_Price) / MRP) * 100
    'promo_my_brand': 'PROMO_MY_BRAND_CALC',

    // Promo Compete - Competitor promotional data (Comp_flag = 1)
    // Calculated as: AVG((MRP - Selling_Price) / MRP) * 100
    'promo_compete': 'PROMO_COMPETE_CALC',
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

    const normalizedKey = metricKey.toLowerCase();

    // Currency metrics - display with ₹ symbol and units (K, L, Cr)
    if (['offtake', 'offtakes', 'inorganic_sales', 'ad_spend', 'spend', 'mrp', 'selling_price'].includes(normalizedKey)) {
        return formatCurrency(num);
    }

    // Percentage metrics - MUST display with % symbol, NEVER in Lakhs
    if (['discount', 'availability', 'sos', 'share_of_search', 'market_share', 'ctr', 'click_through_rate', 'conversion'].includes(normalizedKey)) {
        return `${num.toFixed(1)}%`;
    }

    // CPC and CPM - Currency metrics (Cost values)
    if (['cpc', 'cost_per_click', 'cpm', 'cost_per_mille'].includes(normalizedKey)) {
        return formatCurrency(num);
    }

    // Promo metrics - Display as percentage
    if (['promo_my_brand', 'promo_compete'].includes(normalizedKey)) {
        return `${num.toFixed(1)}%`;
    }

    // ROAS - display with 'x' suffix
    if (normalizedKey === 'roas') {
        return `${num.toFixed(2)}x`;
    }

    // Regular numbers (qty_sold, ad_clicks, ad_impressions, etc.)
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
    // Generate cache key based on metric and filters
    const cacheKey = generateCacheKey(`sku_metrics:${metricKey}`, filters);

    return getCachedOrCompute(cacheKey, async () => {
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
    }, CACHE_TTL.SHORT); // 5 minutes - SKU metrics change fairly frequently
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

        // Platform filter
        if (filters.platform && filters.platform !== 'All') {
            whereConditions.push('olap.Platform = :platform');
            replacements.platform = filters.platform;
        }

        // Date range filter
        if (filters.dateFrom && filters.dateTo) {
            whereConditions.push('olap.DATE BETWEEN :dateFrom AND :dateTo');
            replacements.dateFrom = filters.dateFrom;
            replacements.dateTo = filters.dateTo;
        }

        // Brand filter
        if (filters.brand && filters.brand !== 'All') {
            whereConditions.push('olap.Brand = :brand');
            replacements.brand = filters.brand;
        }

        // Location filter
        if (filters.location && filters.location !== 'All') {
            whereConditions.push('olap.Location = :location');
            replacements.location = filters.location;
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        console.log('whereClause:', whereClause);
        console.log('replacements:', replacements);

        // Build the aggregation expression based on metric type
        let aggregationExpr;
        if (dbColumn === 'AVAILABILITY_CALC') {
            // Special calculation for Availability: (neno_osa / deno_osa) * 100
            aggregationExpr = '(SUM(olap.neno_osa) / NULLIF(SUM(olap.deno_osa), 0)) * 100';
        } else if (dbColumn === 'CTR_CALC') {
            // CTR (Click-Through Rate): (Ad_Clicks / Ad_Impressions) * 100
            aggregationExpr = '(SUM(olap.Ad_Clicks) / NULLIF(SUM(olap.Ad_Impressions), 0)) * 100';
        } else if (dbColumn === 'SOS_CALC') {
            // SOS (Share of Search): (keyword_is_rb_product=1 count) / (total count) * 100
            // This requires a special query to rb_kw table
            return await fetchSosByProduct(filters, metricKey);
        } else if (dbColumn === 'MARKET_SHARE_CALC') {
            // Market Share: (Sales of our brands) / (Total sales) * 100
            // This requires a special query to rb_brand_ms with rca_sku_dim join
            return await fetchMarketShareByProduct(filters, metricKey);
        } else if (dbColumn === 'ROAS_CALC') {
            // ROAS (Return on Ad Spend): Ad_sales / Ad_Spend
            aggregationExpr = 'SUM(olap.Ad_sales) / NULLIF(SUM(olap.Ad_Spend), 0)';
        } else if (dbColumn === 'CPC_CALC') {
            // CPC (Cost Per Click): Ad_Spend / Ad_Clicks
            aggregationExpr = 'SUM(olap.Ad_Spend) / NULLIF(SUM(olap.Ad_Clicks), 0)';
        } else if (dbColumn === 'CPM_CALC') {
            // CPM (Cost Per Mille): (Ad_Spend / Ad_Impressions) * 1000
            aggregationExpr = '(SUM(olap.Ad_Spend) / NULLIF(SUM(olap.Ad_Impressions), 0)) * 1000';
        } else if (dbColumn === 'PROMO_MY_BRAND_CALC') {
            // Promo My Brand: Average promo depth for Comp_flag = 0 (own brand)
            // Formula: AVG((MRP - Selling_Price) / MRP) * 100
            // MRP and Selling_Price are string columns, so we CAST them to DECIMAL
            aggregationExpr = 'AVG(CASE WHEN olap.Comp_flag = 0 AND CAST(olap.MRP AS DECIMAL) > 0 THEN (CAST(olap.MRP AS DECIMAL) - CAST(olap.Selling_Price AS DECIMAL)) / CAST(olap.MRP AS DECIMAL) ELSE 0 END) * 100';
        } else if (dbColumn === 'PROMO_COMPETE_CALC') {
            // Promo Compete: Average promo depth for Comp_flag = 1 (competitors)
            // Formula: AVG((MRP - Selling_Price) / MRP) * 100
            // MRP and Selling_Price are string columns, so we CAST them to DECIMAL
            aggregationExpr = 'AVG(CASE WHEN olap.Comp_flag = 1 AND CAST(olap.MRP AS DECIMAL) > 0 THEN (CAST(olap.MRP AS DECIMAL) - CAST(olap.Selling_Price AS DECIMAL)) / CAST(olap.MRP AS DECIMAL) ELSE 0 END) * 100';
        } else {
            aggregationExpr = `SUM(olap.${dbColumn})`;
        }

        // Use raw SQL query to fetch SKU data directly from rb_pdp_olap
        // Use Product column as SKU name, and Category for grouping
        const query = `
            SELECT 
                olap.Product AS sku_name,
                olap.Category AS category,
                olap.Platform AS platform,
                ${aggregationExpr} AS total_value
            FROM rb_pdp_olap AS olap
            ${whereClause}
            GROUP BY olap.Product, olap.Category, olap.Platform
            ORDER BY total_value DESC
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
            const category = row.category || 'Uncategorized';
            const platform = row.platform;
            const value = parseFloat(row.total_value) || 0;

            if (!skuMap[skuName]) {
                skuMap[skuName] = {
                    name: skuName,
                    category: category,
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

        // Format the values - structure must match frontend expectations
        // Frontend expects: cat[platform][metricKey] and cat[platform][metricKey + '_change']
        const formattedResults = Object.values(skuMap).map(sku => {
            const formatted = {
                name: sku.name,
                category: sku.category  // Add category field for frontend display
            };

            // Format each platform value
            // Instead of {platform: {value, change}}, return {platform: {[metricKey]: value, [metricKey_change]: change}}
            ['all', 'blinkit', 'zepto', 'swiggy', 'amazon', 'flipkart'].forEach(platform => {
                formatted[platform] = {
                    [metricKey]: formatMetricValue(sku[platform].value, metricKey),
                    [metricKey + '_change']: '-'  // Placeholder for change - calculate if historical data available
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

/**
 * Fetch SOS (Share of Search) by Product/SKU
 * Formula: (keyword_is_rb_product=1 count) / (total count) * 100
 */
async function fetchSosByProduct(filters, metricKey) {
    try {
        console.log('=== fetchSosByProduct called ===');

        // Build WHERE conditions
        const where = {};
        if (filters.dateFrom && filters.dateTo) {
            where.created_on = { [Op.between]: [filters.dateFrom, filters.dateTo] };
        }
        where.keyword_search_rank = { [Op.lt]: 11 };
        if (filters.platform && filters.platform !== 'All') {
            where.platform_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), filters.platform.toLowerCase());
        }
        if (filters.location && filters.location !== 'All') {
            where.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), filters.location.toLowerCase());
        }

        // Numerator: keyword_is_rb_product = 1 counts by product
        const numData = await RbKw.findAll({
            attributes: [
                'keyword_search_product',
                'platform_name',
                [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
            ],
            where: { ...where, keyword_is_rb_product: 1 },
            group: ['keyword_search_product', 'platform_name'],
            raw: true
        });

        // Denominator: total counts by product
        const denomData = await RbKw.findAll({
            attributes: [
                'keyword_search_product',
                'platform_name',
                [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
            ],
            where: where,
            group: ['keyword_search_product', 'platform_name'],
            raw: true
        });

        // Build maps
        const numMap = new Map(numData.map(r => [`${r.keyword_search_product}|${r.platform_name}`, parseInt(r.count) || 0]));
        const denomMap = new Map(denomData.map(r => [`${r.keyword_search_product}|${r.platform_name}`, parseInt(r.count) || 0]));

        // Group by product
        const skuMap = {};
        denomData.forEach(row => {
            const sku = row.keyword_search_product || 'Unknown';
            const platform = row.platform_name?.toLowerCase() || 'unknown';
            const denomCount = parseInt(row.count) || 0;
            const numCount = numMap.get(`${row.keyword_search_product}|${row.platform_name}`) || 0;
            const sos = denomCount > 0 ? (numCount / denomCount) * 100 : 0;

            if (!skuMap[sku]) {
                skuMap[sku] = {
                    name: sku,
                    category: '',
                    all: { value: 0 },
                    blinkit: { value: 0 },
                    zepto: { value: 0 },
                    swiggy: { value: 0 },
                    amazon: { value: 0 },
                    flipkart: { value: 0 }
                };
            }

            if (skuMap[sku][platform]) {
                skuMap[sku][platform].value = sos;
            }
        });

        // Calculate "all" as average across platforms
        Object.values(skuMap).forEach(sku => {
            const platforms = ['blinkit', 'zepto', 'swiggy', 'amazon', 'flipkart'];
            const values = platforms.map(p => sku[p].value).filter(v => v > 0);
            sku.all.value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        });

        // Format results
        return Object.values(skuMap).map(sku => {
            const formatted = { name: sku.name, category: sku.category };
            ['all', 'blinkit', 'zepto', 'swiggy', 'amazon', 'flipkart'].forEach(platform => {
                formatted[platform] = {
                    [metricKey]: formatMetricValue(sku[platform].value, metricKey),
                    [metricKey + '_change']: '-'
                };
            });
            return formatted;
        });
    } catch (error) {
        console.error('Error in fetchSosByProduct:', error);
        return [];
    }
}

/**
 * Fetch Market Share by Product/SKU
 * Formula: (Sales of product with Comp_flag=0) / (Total platform sales) * 100
 * Uses rb_pdp_olap.Product column for SKU-level data
 */
async function fetchMarketShareByProduct(filters, metricKey) {
    try {
        console.log('=== fetchMarketShareByProduct called ===');

        // Build WHERE conditions for rb_pdp_olap
        const baseWhere = { Comp_flag: 0 }; // Our products only
        if (filters.dateFrom && filters.dateTo) {
            baseWhere.DATE = { [Op.between]: [filters.dateFrom, filters.dateTo] };
        }
        if (filters.platform && filters.platform !== 'All') {
            baseWhere.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), filters.platform.toLowerCase());
        }
        if (filters.location && filters.location !== 'All') {
            baseWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), filters.location.toLowerCase());
        }
        if (filters.brand && filters.brand !== 'All') {
            baseWhere.Brand = { [Op.like]: `%${filters.brand}%` };
        }

        // Numerator: Our products sales by Product/Platform (Comp_flag = 0)
        const numData = await RbPdpOlap.findAll({
            attributes: [
                'Product',
                'Platform',
                'Category',
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'product_sales']
            ],
            where: baseWhere,
            group: ['Product', 'Platform', 'Category'],
            raw: true
        });

        // Build total where (all products, not just ours)
        const totalWhere = {};
        if (filters.dateFrom && filters.dateTo) {
            totalWhere.DATE = { [Op.between]: [filters.dateFrom, filters.dateTo] };
        }
        if (filters.platform && filters.platform !== 'All') {
            totalWhere.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), filters.platform.toLowerCase());
        }
        if (filters.location && filters.location !== 'All') {
            totalWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), filters.location.toLowerCase());
        }

        // Denominator: Total sales by platform (all products including competitors)
        const denomData = await RbPdpOlap.findAll({
            attributes: [
                'Platform',
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']
            ],
            where: totalWhere,
            group: ['Platform'],
            raw: true
        });

        // Build denominator map (platform -> total sales)
        const denomMap = new Map(denomData.map(r => [r.Platform?.toLowerCase(), parseFloat(r.total_sales || 0)]));

        // Group by Product as SKU
        const skuMap = {};
        numData.forEach(row => {
            const sku = row.Product || 'Unknown';
            const platform = row.Platform?.toLowerCase() || 'unknown';
            const category = row.Category || '';
            const productSales = parseFloat(row.product_sales || 0);
            const totalSales = denomMap.get(platform) || 0;
            const ms = totalSales > 0 ? (productSales / totalSales) * 100 : 0;

            if (!skuMap[sku]) {
                skuMap[sku] = {
                    name: sku,
                    category: category,
                    all: { value: 0 },
                    blinkit: { value: 0 },
                    zepto: { value: 0 },
                    swiggy: { value: 0 },
                    amazon: { value: 0 },
                    flipkart: { value: 0 }
                };
            }

            if (skuMap[sku][platform]) {
                skuMap[sku][platform].value = ms;
            }
            // Update category if not set
            if (!skuMap[sku].category && category) {
                skuMap[sku].category = category;
            }
        });

        // Calculate "all" as average across platforms
        Object.values(skuMap).forEach(sku => {
            const platforms = ['blinkit', 'zepto', 'swiggy', 'amazon', 'flipkart'];
            const values = platforms.map(p => sku[p].value).filter(v => v > 0);
            sku.all.value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        });

        // Format results
        return Object.values(skuMap).map(sku => {
            const formatted = { name: sku.name, category: sku.category };
            ['all', 'blinkit', 'zepto', 'swiggy', 'amazon', 'flipkart'].forEach(platform => {
                formatted[platform] = {
                    [metricKey]: formatMetricValue(sku[platform].value, metricKey),
                    [metricKey + '_change']: '-'
                };
            });
            return formatted;
        });
    } catch (error) {
        console.error('Error in fetchMarketShareByProduct:', error);
        return [];
    }
}

export default {
    getSkuMetrics
};
