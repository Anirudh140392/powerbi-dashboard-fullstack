import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'async_hooks';
import { getOlapTableName } from '../utils/olapResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const clickhouseStorage = new AsyncLocalStorage();

const defaultDb = process.env.CLICKHOUSE_DB || 'prestige';

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    database: defaultDb,
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    request_timeout: 120000,
});

const maricoClickhouse = createClient({
    url: process.env.MARICO_CLICKHOUSE_HOST || process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    database: process.env.MARICO_CLICKHOUSE_DB || 'marico_true_element',
    username: process.env.MARICO_CLICKHOUSE_USER || process.env.CLICKHOUSE_USER || 'default',
    password: process.env.MARICO_CLICKHOUSE_PASSWORD || process.env.CLICKHOUSE_PASSWORD || '',
    request_timeout: 120000,
});

// Intercept clickhouse.query to inject request-scoped database overrides and route to correct ClickHouse cluster
const originalQuery = clickhouse.query;
const originalMaricoQuery = maricoClickhouse.query;

clickhouse.query = function (options) {
    const store = clickhouseStorage.getStore();
    const targetDb = store?.dbName || options?.database || options?.clickhouse_settings?.database;
    const isMarico = targetDb && targetDb.toLowerCase().includes('marico');

    if (targetDb && (!options.query || !options.query.includes('admin_master'))) {
        options.clickhouse_settings = {
            ...options.clickhouse_settings,
            database: targetDb
        };
        console.log(`[CH Query] Intercepted. Database: ${targetDb}, Query: ${options.query?.substring(0, 100).replace(/\s+/g, ' ')}`);
    } else {
        console.log(`[CH Query] Querying admin_master or default. Query: ${options.query?.substring(0, 100).replace(/\s+/g, ' ')}`);
    }

    if (isMarico) {
        return originalMaricoQuery.call(maricoClickhouse, options);
    }
    return originalQuery.call(this, options);
};

(async function warmUpPool(retries = 5, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await clickhouse.query({ query: 'SELECT 1', format: 'JSONEachRow' });
            console.log(`[CH] Client warm-up successful (attempt ${attempt})`);
            return;
        } catch (err) {
            console.warn(`[CH] Client warm-up attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt < retries) {
                console.log(`[CH] Retrying in ${delayMs}ms...`);
                await new Promise(r => setTimeout(r, delayMs));
            } else {
                console.error('[CH] Client warm-up exhausted all retries. Queries will fail until CH recovers.');
            }
        }
    }
})();

const DB_HEALTH_PING_MS = parseInt(process.env.DB_HEALTH_PING_MS || '25000');
const dbHealthTimer = setInterval(() => {
    clickhouse.query({ query: 'SELECT 1', format: 'JSONEachRow' }).catch((err) => {
        console.warn(`[CH] health ping failed: ${err.message}`);
    });
}, DB_HEALTH_PING_MS);
dbHealthTimer.unref();

const companyIdCache = new Map();

export async function resolveCompanyUuid(dbName) {
    if (!dbName) return process.env.COMPANY_ID || '297e37ea-a5ac-47df-bebd-ac44e52b7979';
    const normalizedDb = dbName.toLowerCase().trim();
    
    if (companyIdCache.has(normalizedDb)) {
        return companyIdCache.get(normalizedDb);
    }
    
    try {
        const olapTable = getOlapTableName(normalizedDb);
        const res = await clickhouse.query({
            query: `SELECT DISTINCT company_id FROM ${olapTable} LIMIT 1`,
            format: 'JSONEachRow',
            clickhouse_settings: {
                database: normalizedDb
            }
        });
        const rows = await res.json();
        if (rows.length > 0 && rows[0].company_id) {
            const uuid = rows[0].company_id;
            companyIdCache.set(normalizedDb, uuid);
            console.log(`[Company UUID Resolver] Resolved company UUID from ${olapTable} for database "${normalizedDb}" -> "${uuid}"`);
            return uuid;
        }
    } catch (err) {
        // Table might not exist, proceed to fallbacks
    }

    try {
        const res = await clickhouse.query({
            query: `SELECT DISTINCT company_id FROM product_snapshots LIMIT 1`,
            format: 'JSONEachRow',
            clickhouse_settings: {
                database: normalizedDb
            }
        });
        const rows = await res.json();
        if (rows.length > 0 && rows[0].company_id) {
            const uuid = rows[0].company_id;
            companyIdCache.set(normalizedDb, uuid);
            console.log(`[Company UUID Resolver] Resolved company UUID from product_snapshots for database "${normalizedDb}" -> "${uuid}"`);
            return uuid;
        }
    } catch (err) {
        console.warn(`[Company UUID Resolver] Failed to resolve from product_snapshots in "${normalizedDb}":`, err.message);
    }

    try {
        const res = await clickhouse.query({
            query: `SELECT DISTINCT company_id FROM ml_reviews LIMIT 1`,
            format: 'JSONEachRow',
            clickhouse_settings: {
                database: normalizedDb
            }
        });
        const rows = await res.json();
        if (rows.length > 0 && rows[0].company_id) {
            const uuid = rows[0].company_id;
            companyIdCache.set(normalizedDb, uuid);
            console.log(`[Company UUID Resolver] Resolved company UUID for database "${normalizedDb}" (fallback) -> "${uuid}"`);
            return uuid;
        }
    } catch (err) {
        console.warn(`[Company UUID Resolver] Failed to resolve from ml_reviews in "${normalizedDb}":`, err.message);
    }

    let fallbackUuid = process.env.COMPANY_ID || '297e37ea-a5ac-47df-bebd-ac44e52b7979';
    if (normalizedDb === 'prestige') fallbackUuid = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
    if (normalizedDb === 'danone') fallbackUuid = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b';
    return fallbackUuid;
}

export default clickhouse;
