import 'dotenv/config';
import { createClient } from '@clickhouse/client';
import { AsyncLocalStorage } from 'node:async_hooks';

// AsyncLocalStorage to store the current user's database name per request
export const dbStorage = new AsyncLocalStorage();

// Cache of ClickHouse clients per database name
const clientCache = new Map();

/**
 * Get or create a ClickHouse client for a specific database
 */
function getClientForDb(dbName) {
    if (clientCache.has(dbName)) {
        return clientCache.get(dbName);
    }

    const urlToUse = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

    const client = createClient({
        url: urlToUse,
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
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
    console.log(`[ClickHouse Report Service] Created client for database: ${dbName} at ${urlToUse}`);
    return client;
}

// Default client (uses CLICKHOUSE_DB from .env)
const defaultDbName = process.env.CLICKHOUSE_DB || 'colpal';
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
export const streamClickHouse = async (query, params = {}, clickhouse_settings = {}) => {
    const client = getCurrentClient();
    const dbName = getCurrentDbName();
    console.log(`[ClickHouse Stream Report Service] DB: ${dbName} | Query: ${query.replace(/\s+/g, ' ').slice(0, 200)}...`);

    const queryOptions = {
        query,
        query_params: params,
        format: 'JSONEachRow',
    };

    if (Object.keys(clickhouse_settings).length > 0) {
        queryOptions.clickhouse_settings = clickhouse_settings;
    }

    const resultSet = await client.query(queryOptions);
    return resultSet.stream();
};

export default clickhouse;
