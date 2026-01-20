// src/config/clickhouse.js
import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
    request_timeout: 60000,
    max_open_connections: 10,
    compression: {
        request: true,
        response: true,
    },
});

export const connectClickHouse = async () => {
    try {
        const result = await clickhouse.query({
            query: 'SELECT 1',
            format: 'JSONEachRow',
        });
        await result.json();
        console.log('✅ Connected to ClickHouse');
        return true;
    } catch (err) {
        console.error('❌ Unable to connect to ClickHouse:', err.message);
        return false;
    }
};

// Helper function to run queries
export const queryClickHouse = async (query, params = {}) => {
    try {
        console.log('[ClickHouse] Executing query:', query.substring(0, 200));
        const result = await clickhouse.query({
            query,
            query_params: params,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('[ClickHouse] Query returned', data.length, 'rows');
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
        await clickhouse.insert({
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
