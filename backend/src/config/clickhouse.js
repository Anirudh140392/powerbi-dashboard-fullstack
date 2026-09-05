// src/config/clickhouse.js
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

    const client = createClient({
        url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
        database: dbName,
        request_timeout: 600000, // 10 minutes for large report downloads
        max_open_connections: 10,
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
    console.log(`[ClickHouse] Created client for database: ${dbName}`);
    return client;
}

// Default client (uses CLICKHOUSE_DB from .env)
const defaultDbName = process.env.CLICKHOUSE_DB;
const clickhouse = getClientForDb(defaultDbName);

/**
 * Set the current request's database name in AsyncLocalStorage
 * Called by authMiddleware after JWT verification
 */
export function setCurrentDbName(dbName) {
    const store = dbStorage.getStore();
    if (store) {
        store.dbName = dbName;
    }
}

/**
 * Get the current request's database name from AsyncLocalStorage
 * Falls back to the default CLICKHOUSE_DB from .env
 */
export function getCurrentDbName() {
    const store = dbStorage.getStore();
    return (store && store.dbName) || defaultDbName;
}

/**
 * Calculates Conversion for all dashboard profiles.
 * Unified Formula: Orders / Clicks
 */
export function calculateConversion(orders = 0, impressions = 0, clicks = 0) {
    return clicks > 0 ? (orders / clicks) * 100 : 0;
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
 * Must be applied BEFORE routes
 */
export function asyncStorageMiddleware(req, res, next) {
    dbStorage.run({ dbName: defaultDbName }, () => {
        next();
    });
}

export const connectClickHouse = async () => {
    try {
        const result = await clickhouse.query({
            query: 'SELECT 1',
            format: 'JSONEachRow',
        });
        await result.json();
        console.log('✅ Connected to ClickHouse (default DB:', defaultDbName, ')');
        return true;
    } catch (err) {
        console.error('❌ Unable to connect to ClickHouse:', err.message);
        return false;
    }
};

// Helper function to run queries - automatically uses the correct DB per request
export const queryClickHouse = async (query, params = {}, clickhouse_settings = {}) => {
    try {
        const client = getCurrentClient();
        const dbName = getCurrentDbName();
        // LOG ALL QUERIES FOR DEBUGGING
        console.log(`[ClickHouse Debug] DB: ${dbName} | Query: ${query.replace(/\s+/g, ' ')}`);
        
        const maxMemoryUsage = process.env.CLICKHOUSE_MAX_MEMORY_USAGE
            ? parseInt(process.env.CLICKHOUSE_MAX_MEMORY_USAGE, 10)
            : 10737418240; // 10 GB default memory limit (increased from server 400 MB limit)

        const result = await client.query({
            query,
            query_params: params,
            format: 'JSONEachRow',
            clickhouse_settings: {
                max_memory_usage: maxMemoryUsage,
                max_bytes_before_external_group_by: 2147483648, // 2 GB spill to disk for GROUP BY
                max_bytes_before_external_sort: 2147483648, // 2 GB spill to disk for ORDER BY
                ...clickhouse_settings,
            },
        });
        const data = await result.json();
        console.log(`[ClickHouse Debug] Result: ${data.length} rows`);
        return data;
    } catch (err) {
        console.error('[ClickHouse] Query failed:', err.message);
        console.error('[ClickHouse] Full error:', err);
        throw err;
    }
};

// Helper for insert operations
export const insertClickHouse = async (table, values) => {
    try {
        const client = getCurrentClient();
        await client.insert({
            table,
            values,
            format: 'JSONEachRow',
        });
        return true;
    } catch (err) {
        console.error('ClickHouse insert error:', err.message);
        throw err;
    }
};

export default clickhouse;
