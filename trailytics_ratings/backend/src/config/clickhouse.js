import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.CLICKHOUSE_DATABASE) {
    console.error('CRITICAL: CLICKHOUSE_DATABASE environment variable is missing. The Overview module cannot start without a client database.');
    process.exit(1);
}

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    database: process.env.CLICKHOUSE_DATABASE,
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    request_timeout: 120000,
});

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

export default clickhouse;
