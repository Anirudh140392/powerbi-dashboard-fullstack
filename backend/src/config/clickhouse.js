// src/config/clickhouse.js
import 'dotenv/config';
import { createClient } from '@clickhouse/client';
import { AsyncLocalStorage } from 'node:async_hooks';

// AsyncLocalStorage to store the current user's database name per request
const dbStorage = new AsyncLocalStorage();

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
        request_timeout: 60000,
        max_open_connections: 10,
        compression: {
            request: true,
            response: true,
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
export const queryClickHouse = async (query, params = {}) => {
    try {
        const client = getCurrentClient();
        const dbName = getCurrentDbName();
        // LOG ALL QUERIES FOR DEBUGGING
        console.log(`[ClickHouse Debug] DB: ${dbName} | Query: ${query.replace(/\s+/g, ' ')}`);
        
        const result = await client.query({
            query,
            query_params: params,
            format: 'JSONEachRow',
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
