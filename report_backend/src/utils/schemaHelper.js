import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';

const tableColumnsCache = new Map();
const TABLE_COLUMNS_TTL = 10 * 60 * 1000; // 10 minutes

export async function getTableColumns(tableName) {
    const dbName = getCurrentDbName();
    const cacheKey = `${dbName}:${tableName}`;

    const cached = tableColumnsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < TABLE_COLUMNS_TTL) {
        return cached.columns;
    }

    try {
        const result = await queryClickHouse(`DESCRIBE TABLE ${tableName}`);
        const columns = new Map();
        columns.rawColumns = new Set();

        for (const row of result) {
            const colName = row.name || row.Name;
            if (colName) {
                const lowerColName = colName.toLowerCase();
                if (columns.has(lowerColName)) {
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
        return columns;
    } catch (error) {
        console.error(`[ColumnDiscovery] Failed to describe ${tableName}:`, error.message);
        const columns = new Map();
        columns.rawColumns = new Set();
        return columns;
    }
}

export function resolveColumn(columnsMap, expectedName, fallback = null) {
    if (!columnsMap || columnsMap.size === 0) {
        return fallback || expectedName;
    }

    const lowerExpected = expectedName.toLowerCase();

    if (columnsMap.has(lowerExpected)) {
        return columnsMap.get(lowerExpected);
    }

    const typoMap = {
        'quantity': ['quanity'],
        'quanity': ['quantity'],
        'market_share': ['marketshare', 'ms'],
        'marketshare': ['market_share', 'ms'],
        'image_url': ['imageurl', 'image url', 'product_image', 'image', 'picture', 'image_link', 'img_url'],
    };

    for (const [key, aliases] of Object.entries(typoMap)) {
        if (lowerExpected.includes(key)) {
            for (const alias of aliases) {
                const search = lowerExpected.replace(key, alias);
                if (columnsMap.has(search)) return columnsMap.get(search);
            }
        }
    }

    const normalizedTarget = lowerExpected.replace(/[_\s]/g, '');
    for (const [lowerActual, actualName] of columnsMap) {
        if (lowerActual.replace(/[_\s]/g, '') === normalizedTarget) {
            return actualName;
        }
    }

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

    return fallback || expectedName;
}

export function columnExists(columnsMap, columnName) {
    if (!columnsMap || columnsMap.size === 0) return true;
    return columnsMap.has(columnName.toLowerCase());
}
