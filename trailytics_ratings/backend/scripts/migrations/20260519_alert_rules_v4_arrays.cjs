/**
 * Alert rules v4 — multi-select arrays + competitor scope.
 *
 * Replaces the single-value brand_filter / category_filter / platform / etc.
 * with proper arrays so an admin can write rules like "all Prestige + Bajaj
 * Pressure Cookers AND Kadais on Amazon".
 *
 * Existing rules: backwards-compatible. The old single-value columns stay;
 * the engine reads BOTH (e.g. brands[] OR brand_filter) so old rules still
 * evaluate exactly as before. Once UI is fully migrated we can drop the
 * singletons in a future cleanup migration.
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
        `ALTER TABLE ratings.alert_rules
            ADD COLUMN IF NOT EXISTS is_competitor_scope TEXT NOT NULL DEFAULT 'prestige',
            ADD COLUMN IF NOT EXISTS platforms           TEXT[] NOT NULL DEFAULT '{}'::text[],
            ADD COLUMN IF NOT EXISTS brands              TEXT[] NOT NULL DEFAULT '{}'::text[],
            ADD COLUMN IF NOT EXISTS categories          TEXT[] NOT NULL DEFAULT '{}'::text[],
            ADD COLUMN IF NOT EXISTS web_pids            TEXT[] NOT NULL DEFAULT '{}'::text[]`,

        `DO $$
         BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_competitor_scope_check') THEN
                 ALTER TABLE ratings.alert_rules
                     ADD CONSTRAINT alert_rules_competitor_scope_check
                     CHECK (is_competitor_scope IN ('all', 'prestige', 'competitors'));
             END IF;
         END $$`,
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
