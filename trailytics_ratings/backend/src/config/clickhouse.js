import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'async_hooks';

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

// Intercept clickhouse.query to inject request-scoped database overrides
const originalQuery = clickhouse.query;
clickhouse.query = function (options) {
    const store = clickhouseStorage.getStore();
    if (store && store.dbName) {
        console.log(`[CH Query] Intercepted. Database: ${store.dbName}, CompanyId: ${store.companyId}, Query: ${options.query?.substring(0, 100).replace(/\s+/g, ' ')}`);
        options.clickhouse_settings = {
            ...options.clickhouse_settings,
            database: store.dbName
        };
    } else {
        console.log(`[CH Query] No request store found. Using default database: ${defaultDb}, Query: ${options.query?.substring(0, 100).replace(/\s+/g, ' ')}`);
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
            console.log(`[Company UUID Resolver] Resolved company UUID for database "${normalizedDb}" -> "${uuid}"`);
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
