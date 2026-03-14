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

        for (const row of result) {
            // ClickHouse DESCRIBE can return column name in 'name' or 'Name' field
            const colName = row.name || row.Name;
            if (colName) {
                columns.set(colName.toLowerCase(), colName);
            }
        }

        tableColumnsCache.set(cacheKey, { columns, timestamp: Date.now() });
        console.log(`🔍 [ColumnDiscovery] DB=${dbName}, Table=${tableName}: ${columns.size} columns discovered`);
        return columns;
    } catch (error) {
        console.error(`[ColumnDiscovery] Failed to describe ${tableName}:`, error.message);
        // Return empty map on failure so direct calls fall back to expected names safely
        return new Map();
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

    // 2. Fuzzy match (remove underscores and spaces to handle Platform_Name vs PlatformName)
    const normalizedTarget = lowerExpected.replace(/[_\s]/g, '');
    for (const [lowerActual, actualName] of columnsMap) {
        if (lowerActual.replace(/[_\s]/g, '') === normalizedTarget) {
            return actualName;
        }
    }

    // 3. Fallback
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
