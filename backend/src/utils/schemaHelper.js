import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';

// Global cache for table columns to minimize DESCRIBE TABLE calls
const tableColumnsCache = new Map(); // key: `${dbName}:${tableName}` → { columns: Map<lowercase, actualName>, timestamp }
const TABLE_COLUMNS_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get actual column names for a table in the current database.
 * Returns a Map of lowercased column name → actual column name as it exists in the DB.
 * 
 * @param {string} tableName - Name of the table to discover columns for
 * @returns {Promise<Map<string, string>>} Map of lowercased names to actual names
 */
export async function getTableColumns(tableName) {
    const dbName = getCurrentDbName();
    const cacheKey = `${dbName}:${tableName}`;

    // Check cache
    const cached = tableColumnsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < TABLE_COLUMNS_TTL) {
        return cached.columns;
    }

    try {
        const result = await queryClickHouse(`DESCRIBE TABLE ${tableName}`);
        const columns = new Map();
        columns.rawColumns = new Set();

        for (const row of result) {
            // ClickHouse DESCRIBE can return column name in 'name' or 'Name' field
            const colName = row.name || row.Name;
            if (colName) {
                const lowerColName = colName.toLowerCase();
                if (columns.has(lowerColName)) {
                    // If we have a duplicate casing (e.g. 'msl' and 'MSL'), prefer the exact lowercase one
                    if (colName === lowerColName) {
                        columns.set(lowerColName, colName);
                    }
                } else {
                    columns.set(lowerColName, colName);
                }
                columns.rawColumns.add(colName);
            }
        }

        tableColumnsCache.set(cacheKey, { columns, timestamp: Date.now() });
        console.log(`🔍 [ColumnDiscovery] DB=${dbName}, Table=${tableName}: ${columns.size} columns discovered`);
        return columns;
    } catch (error) {
        console.error(`[ColumnDiscovery] Failed to describe ${tableName}:`, error.message);
        // Return empty map on failure so direct calls fall back to expected names safely
        const columns = new Map();
        columns.rawColumns = new Set();
        return columns;
    }
}

/**
 * Resolve a column name case-insensitively using a discovered columns map.
 * 
 * @param {Map<string, string>} columnsMap - Map returned by getTableColumns()
 * @param {string} expectedName - The column name you expect (any casing)
 * @param {string} fallback - Optional fallback name if the column doesn't exist
 * @returns {string} The actual column name from the database, or the fallback/expected name
 */
export function resolveColumn(columnsMap, expectedName, fallback = null) {
    if (!columnsMap || columnsMap.size === 0) {
        return fallback || expectedName;
    }

    const lowerExpected = expectedName.toLowerCase();

    // 1. Direct lowercase match (covers most cases like ad_sales vs Ad_sales)
    if (columnsMap.has(lowerExpected)) {
        return columnsMap.get(lowerExpected);
    }

    // 2. Metric Synonyms and Typos Map
    const synonymMap = {
        'offtake': ['sales', 'offtake', 'offtakes', 'gross_sales', 'total_sales', 'sales_val', 'sales_value'],
        'sales': ['sales', 'offtake', 'offtakes', 'gross_sales', 'total_sales', 'sales_val', 'sales_value'],
        'units_sold': ['qty_sold', 'quantity_sold', 'units_sold', 'qty', 'quantity', 'units', 'organic_qty'],
        'quantity_sold': ['qty_sold', 'units_sold', 'quantity_sold', 'qty', 'quantity', 'units', 'organic_qty'],
        'qty_sold': ['qty_sold', 'units_sold', 'quantity_sold', 'qty', 'quantity', 'units', 'organic_qty'],
        'spend': ['ad_spend', 'spend', 'sp_ad_spend', 'sd_ad_spend'],
        'ad_spend': ['ad_spend', 'spend', 'sp_ad_spend', 'sd_ad_spend'],
        'inorganic_sales': ['ad_sales', 'inorganic_sales', 'sp_ad_sales', 'sd_ad_sales'],
        'ad_sales': ['ad_sales', 'inorganic_sales', 'sp_ad_sales', 'sd_ad_sales'],
        'clicks': ['ad_clicks', 'clicks', 'sp_ad_clicks', 'sd_ad_clicks'],
        'ad_clicks': ['ad_clicks', 'clicks', 'sp_ad_clicks', 'sd_ad_clicks'],
        'impressions': ['ad_impressions', 'impressions', 'sp_ad_impressions', 'sd_ad_impressions'],
        'ad_impressions': ['ad_impressions', 'impressions', 'sp_ad_impressions', 'sd_ad_impressions'],
        'discount_percentage': ['discount', 'discount_percent', 'discount_percentage', 'promo_percentage', 'promo_percent'],
        'discount': ['discount', 'discount_percent', 'discount_percentage', 'promo_percentage', 'promo_percent'],
        'current_inventory': ['inventory', 'current_inventory', 'stock_inventory'],
        'inventory': ['inventory', 'current_inventory', 'stock_inventory'],
        'target_inventory': ['target_inventory', 'dih', 'inventory'],
        'orders': ['orders', 'order_count', 'total_orders', 'ad_quantity_sold', 'qty_sold'],
        'quantity': ['quanity', 'qty_sold', 'units_sold', 'quantity'],
        'quanity': ['quantity', 'qty_sold', 'units_sold', 'quanity'],
        'market_share': ['marketshare', 'ms'],
        'marketshare': ['market_share', 'ms'],
        'image_url': ['imageurl', 'image url', 'product_image', 'image', 'picture', 'image_link', 'img_url'],
    };

    for (const [key, aliases] of Object.entries(synonymMap)) {
        if (lowerExpected === key || lowerExpected.includes(key)) {
            for (const alias of aliases) {
                if (columnsMap.has(alias)) return columnsMap.get(alias);
            }
        }
    }

    // 3. Fuzzy match (remove underscores and spaces to handle Platform_Name vs PlatformName)
    const normalizedTarget = lowerExpected.replace(/[_\s]/g, '');
    for (const [lowerActual, actualName] of columnsMap) {
        if (lowerActual.replace(/[_\s]/g, '') === normalizedTarget) {
            return actualName;
        }
    }

    // 4. Even fuzzier match for quantity typo
    if (normalizedTarget.includes('quantity') || normalizedTarget.includes('quanity')) {
        const target = normalizedTarget.replace('quantity', 'quanity');
        const altTarget = normalizedTarget.replace('quanity', 'quantity');
        for (const [lowerActual, actualName] of columnsMap) {
            const normalizedActual = lowerActual.replace(/[_\s]/g, '');
            if (normalizedActual === target || normalizedActual === altTarget) {
                return actualName;
            }
        }
    }

    // 5. Fallback
    return fallback || expectedName;
}

/**
 * Check if a column exists in the table (case-insensitive).
 * 
 * @param {Map<string, string>} columnsMap - Map returned by getTableColumns()
 * @param {string} columnName - The column name to check
 * @returns {boolean}
 */
export function columnExists(columnsMap, columnName) {
    if (!columnsMap || columnsMap.size === 0) return true; // Assume exists if check failed
    return columnsMap.has(columnName.toLowerCase());
}
