import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isRemoteDb = process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST);

const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'),
    connectionTimeoutMillis: 30000,
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '120000'),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

(async function warmUpPool(retries = 5, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const client = await pool.connect();
            client.release();
            console.log(`[DB] Pool warm-up successful (attempt ${attempt})`);
            return;
        } catch (err) {
            const isRecovering = err.code === '57P03';
            console.warn(`[DB] Pool warm-up attempt ${attempt}/${retries} failed: [${err.code}] ${err.message}`);
            if (attempt < retries) {
                const backoff = isRecovering ? delayMs * attempt : delayMs;
                console.log(`[DB] Retrying in ${backoff}ms...`);
                await new Promise(r => setTimeout(r, backoff));
            } else {
                console.error('[DB] Pool warm-up exhausted all retries. Proceeding — queries will fail until DB recovers.');
            }
        }
    }
})();

const DB_HEALTH_PING_MS = parseInt(process.env.DB_HEALTH_PING_MS || '25000');
const dbHealthTimer = setInterval(() => {
    pool.query('SELECT 1').catch((err) => {
        console.warn(`[DB] health ping failed (dead connection evicted): [${err.code || '?'}] ${err.message}`);
    });
}, DB_HEALTH_PING_MS);
dbHealthTimer.unref();

export default pool;
