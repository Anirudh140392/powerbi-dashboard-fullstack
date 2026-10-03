/**
 * Alert events: add category + pareto_status + rating_count columns so
 * the digest email can group SKUs by category → classification and show
 * "X ratings" per row without re-querying at render time.
 *
 * Backwards-compatible: nullable columns, evaluateRule fills them going
 * forward, old rows stay NULL until the next time the same SKU trips
 * (then a new row is inserted with the populated fields).
 *
 * Idempotent: safe to re-run.
 */
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
            ? { rejectUnauthorized: false } : false,
    });

    const statements = [
        `ALTER TABLE ratings.alert_events
            ADD COLUMN IF NOT EXISTS category      TEXT,
            ADD COLUMN IF NOT EXISTS pareto_status TEXT,
            ADD COLUMN IF NOT EXISTS rating_count  INT`,
    ];

    for (const sql of statements) {
        const t = Date.now();
        const name = sql.split('\n')[0].slice(0, 70).trim();
        process.stdout.write(`  ${name.padEnd(70)} `);
        try {
            await pool.query(sql);
            console.log(`OK (${Date.now() - t}ms)`);
        } catch (e) {
            console.log(`FAIL: ${e.message}`);
        }
    }
    await pool.end();
    console.log('\nDone.');
})().catch(e => { console.error(e); process.exit(1); });
