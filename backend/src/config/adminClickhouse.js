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
        idle_socket_ttl: 15000,
    },
});

/**
 * Run a query against the admin_master database
 * Uses the main ClickHouse client with cross-database query syntax
 */
export const queryAdminDB = async (query, params = {}) => {
    try {
        const trimmed = query.trim().toUpperCase();
        const isMutationOrDdl = trimmed.startsWith('ALTER') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE') || trimmed.startsWith('INSERT') || trimmed.startsWith('CREATE') || trimmed.startsWith('DROP');

        if (isMutationOrDdl) {
            console.log('[AdminDB] Executing DDL/Mutation command:', query.substring(0, 200));
            await adminClickhouse.command({
                query,
                query_params: params,
                clickhouse_settings: {
                    max_query_size: 100 * 1024 * 1024,
                    // Wait for ALTER TABLE UPDATE/DELETE mutations to complete
                    // before returning. Without this, mutations are async and
                    // subsequent SELECTs may read stale pre-mutation data.
                    mutations_sync: 1,
                }
            });
            return [];
        }

        console.log('[AdminDB] Executing SELECT query:', query.substring(0, 200));
        const result = await adminClickhouse.query({
            query,
            query_params: params,
            format: 'JSONEachRow',
            clickhouse_settings: {
                max_query_size: 100 * 1024 * 1024, // 100 MB
            }
        });
        const data = await result.json();
        console.log('[AdminDB] Query returned', data.length, 'rows');
        return data;
    } catch (err) {
        console.error('[AdminDB] Query failed:', err.message);
        throw err;
    }
};

/**
 * Insert data into the admin_master database
 */
export const insertAdminDB = async (tableName, values) => {
    try {
        console.log(`[AdminDB] Inserting into ${tableName}`);
        await adminClickhouse.insert({
            table: tableName,
            values,
            format: 'JSONEachRow',
        });
        console.log(`[AdminDB] Insert successful into ${tableName}`);
        return { success: true };
    } catch (err) {
        console.error(`[AdminDB] Insert failed into ${tableName}:`, err.message);
        throw err;
    }
};

export default adminClickhouse;
