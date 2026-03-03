// src/config/adminClickhouse.js
// Query the admin_master database using the existing ClickHouse connection
// Uses cross-database syntax (admin_master.table_name) to avoid creating a second client
import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const ADMIN_DB = process.env.ADMIN_DB || 'admin_master';

// Create a dedicated client for admin queries
const adminClickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: ADMIN_DB,
    request_timeout: 60000,
    max_open_connections: 10,
    compression: {
        request: true,
        response: true,
    },
    keep_alive: {
        enabled: true,
    },
});

/**
 * Run a query against the admin_master database
 * Uses the main ClickHouse client with cross-database query syntax
 */
export const queryAdminDB = async (query, params = {}) => {
    try {
        console.log('[AdminDB] Executing query:', query.substring(0, 200));
        const result = await adminClickhouse.query({
            query,
            query_params: params,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('[AdminDB] Query returned', data.length, 'rows');
        return data;
    } catch (err) {
        console.error('[AdminDB] Query failed:', err.message);
        throw err;
    }
};

export default adminClickhouse;
