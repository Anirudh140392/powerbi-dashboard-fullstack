import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@clickhouse/client';
import { AsyncLocalStorage } from 'node:async_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

// AsyncLocalStorage to store the current user's database name per request
export const dbStorage = new AsyncLocalStorage();

// Cache of ClickHouse clients per database name
const clientCache = new Map();

const MARICO_IMPRESSIONS_CVR_HOST = '13.232.194.195';
const MARICO_IMPRESSIONS_CVR_PORT = '8123';

export function isMaricoDb(dbName = getCurrentDbName()) {
    return Boolean(dbName && String(dbName).toLowerCase().includes('marico'));
}

export function getClickHouseUrlForDb(dbName = getCurrentDbName()) {
    const isMarico = isMaricoDb(dbName);
    return isMarico
        ? (process.env.MARICO_CLICKHOUSE_HOST || process.env.MARICO_CLICKHOUSE_URL || 'http://13.232.194.195:8123')
        : (process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HOST || 'http://13.200.55.131:8123');
}

export function isMaricoImpressionsConversionServer(dbName = getCurrentDbName()) {
    if (!isMaricoDb(dbName)) return false;
    const rawUrl = String(getClickHouseUrlForDb(dbName) || '').trim();
    if (!rawUrl) return false;
    try {
        const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
        const parsed = new URL(normalized);
        return parsed.hostname === MARICO_IMPRESSIONS_CVR_HOST && parsed.port === MARICO_IMPRESSIONS_CVR_PORT;
    } catch {
        return rawUrl.includes(`${MARICO_IMPRESSIONS_CVR_HOST}:${MARICO_IMPRESSIONS_CVR_PORT}`);
    }
}

export function isBigBasketPlatform(platform) {
    if (!platform) return false;
    const rawItems = Array.isArray(platform) ? platform : String(platform).split(',');
    const normalized = rawItems
        .map((p) => String(p || '').trim().toLowerCase().replace(/\s+/g, ''))
        .filter(Boolean);
    if (normalized.length === 0) return false;
    const unique = [...new Set(normalized)];
    return unique.length === 1 && unique[0] === 'bigbasket';
}

export function shouldUseImpressionsConversion({ platform, dbName = getCurrentDbName(), table } = {}) {
    if (table && String(table).trim().toLowerCase() !== 'rb_pm_olap') {
        return false;
    }
    return isMaricoImpressionsConversionServer(dbName) && isBigBasketPlatform(platform);
}

export function isBigBasketPlatformSql(platformExpr) {
    return `lower(replaceAll(trim(toString(ifNull(${platformExpr}, ''))), ' ', '')) = 'bigbasket'`;
}

export function buildPmConversionSql({
    ordersExpr,
    impressionsExpr,
    clicksExpr,
    platformExpr = null,
    platformFilter = null,
    dbName = getCurrentDbName(),
    table = 'rb_pm_olap',
} = {}) {
    const clicksSql = `if(${clicksExpr} > 0, (${ordersExpr} / ${clicksExpr}) * 100, 0)`;
    if (String(table || '').trim().toLowerCase() !== 'rb_pm_olap') return clicksSql;
    if (!isMaricoImpressionsConversionServer(dbName)) return clicksSql;

    const impressionsSql = impressionsExpr
        ? `if(${impressionsExpr} > 0, (${ordersExpr} / ${impressionsExpr}) * 100, 0)`
        : '0';

    if (isBigBasketPlatform(platformFilter)) return impressionsSql;
    if (platformExpr) {
        return `if(${isBigBasketPlatformSql(platformExpr)}, ${impressionsSql}, ${clicksSql})`;
    }
    return clicksSql;
}

/**
 * Get or create a ClickHouse client for a specific database
 */
function getClientForDb(dbName) {
    if (clientCache.has(dbName)) {
        return clientCache.get(dbName);
    }

    const isMarico = isMaricoDb(dbName);
    const urlToUse = getClickHouseUrlForDb(dbName);

    const username = isMarico
        ? (process.env.MARICO_CLICKHOUSE_USER || 'main_user')
        : (process.env.CLICKHOUSE_USER || 'kenil_user');

    const password = isMarico
        ? (process.env.MARICO_CLICKHOUSE_PASSWORD || 'prod_dev@1215')
        : (process.env.CLICKHOUSE_PASSWORD || 'Kenil@Kavar0604');

    const client = createClient({
        url: urlToUse,
        username,
        password,
        database: dbName,
        request_timeout: 600000, // 10 minutes for large report downloads
        max_open_connections: 50,
        compression: {
            request: true,
            response: true,
        },
        keep_alive: {
            enabled: true,
            idle_socket_ttl: 15000,
        },
    });

    clientCache.set(dbName, client);
    console.log(`[ClickHouse Report Service] Created client for database: ${dbName} at ${urlToUse} (user: ${username})`);
    return client;
}

// Default client (uses CLICKHOUSE_DB from .env)
const defaultDbName = process.env.CLICKHOUSE_DB || 'boat';
const clickhouse = getClientForDb(defaultDbName);

/**
 * Set the current request's database name in AsyncLocalStorage
 */
export function setCurrentDbName(dbName) {
    const store = dbStorage.getStore();
    if (store) {
        store.dbName = dbName;
    }
}

/**
 * Get the current request's database name from AsyncLocalStorage
 */
export function getCurrentDbName() {
    const store = dbStorage.getStore();
    return (store && store.dbName) || defaultDbName;
}

/**
 * Get the current ClickHouse client based on the request context
 */
function getCurrentClient() {
    const dbName = getCurrentDbName();
    return getClientForDb(dbName);
}

/**
 * Express middleware to wrap each request in AsyncLocalStorage context
 */
export function asyncStorageMiddleware(req, res, next) {
    dbStorage.run({ dbName: defaultDbName }, () => {
        next();
    });
}

export const queryClickHouse = async (query, params = {}, clickhouse_settings = {}) => {
    try {
        const client = getCurrentClient();
        const dbName = getCurrentDbName();
        console.log(`[ClickHouse Report Service] DB: ${dbName} | Query: ${query.replace(/\s+/g, ' ').slice(0, 150)}...`);

        const queryOptions = {
            query,
            query_params: params,
            format: 'JSONEachRow',
        };

        if (Object.keys(clickhouse_settings).length > 0) {
            queryOptions.clickhouse_settings = clickhouse_settings;
        }

        const result = await client.query(queryOptions);
        const data = await result.json();
        return data;
    } catch (err) {
        console.error('[ClickHouse Report Service] Query failed:', err.message);
        throw err;
    }
};

/**
 * Stream query results from ClickHouse as a Node.js readable stream.
 */
export const streamClickHouse = async (query, params = {}, clickhouse_settings = {}, format = 'JSONEachRow') => {
    const client = getCurrentClient();
    const dbName = getCurrentDbName();
    console.log(`[ClickHouse Stream Report Service] DB: ${dbName} | Query: ${query.replace(/\s+/g, ' ').slice(0, 200)}...`);

    const queryOptions = {
        query,
        query_params: params,
        format,
    };

    if (Object.keys(clickhouse_settings).length > 0) {
        queryOptions.clickhouse_settings = clickhouse_settings;
    }

    const resultSet = await client.query(queryOptions);
    return resultSet.stream();
};

export default clickhouse;
