/**
 * Alert rules v2 — add brand, classification, sentiment_category filters,
 * trigger mode, and actions array.
 *
 * Existing rules continue to work: every new column is nullable / has a
 * default that means "same as before". The alert engine reads these
 * optionally and AND-combines them with the existing scope filter.
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
        // Extra "AND" filters layered on top of the existing scope_type/value
        `ALTER TABLE ratings.alert_rules
            ADD COLUMN IF NOT EXISTS brand_filter        TEXT,           -- e.g. 'Prestige' (NULL = all brands)
            ADD COLUMN IF NOT EXISTS category_filter     TEXT,           -- e.g. 'Pressure Cooker' (NULL = all categories)
            ADD COLUMN IF NOT EXISTS classification      TEXT,           -- 'Pareto' | 'Non-Pareto' | 'NPD' | NULL
            ADD COLUMN IF NOT EXISTS sentiment_category  TEXT,           -- e.g. 'Quality' | 'Performance' | NULL
            ADD COLUMN IF NOT EXISTS min_review_count    INT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS trigger_mode        TEXT NOT NULL DEFAULT 'on_schedule',
            ADD COLUMN IF NOT EXISTS actions             JSONB NOT NULL DEFAULT '["email"]'::jsonb`,

        // trigger_mode: 'on_schedule' (daily pipeline) | 'on_event' (every sync) | 'manual_only' (never auto-fire)
        `DO $$
         BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_trigger_mode_check') THEN
                 ALTER TABLE ratings.alert_rules
                     ADD CONSTRAINT alert_rules_trigger_mode_check
                     CHECK (trigger_mode IN ('on_schedule', 'on_event', 'manual_only'));
             END IF;
         END $$`,

        // classification: optional; restricts evaluation to a specific SKU bucket
        `DO $$
         BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_classification_check') THEN
                 ALTER TABLE ratings.alert_rules
                     ADD CONSTRAINT alert_rules_classification_check
                     CHECK (classification IS NULL OR classification IN ('Pareto', 'Non-Pareto', 'NPD'));
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
