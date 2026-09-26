/**
 * Notifications table + alert_rules v3 (cron + OR-group + custom_cron mode).
 *
 * - ratings.notifications: in-app inbox rows written by alertEngine when a
 *   rule's actions list includes 'in_app'. One row per recipient user.
 * - alert_rules.cron_expression: 5-field cron string used when trigger_mode
 *   is 'custom_cron'. Worker registers a per-rule schedule from this.
 * - alert_rules.or_group: optional second AND-filter group; if non-null,
 *   the engine OR-combines it with the primary filters.
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
        `CREATE TABLE IF NOT EXISTS ratings.notifications (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id      UUID NOT NULL REFERENCES ratings.users(id) ON DELETE CASCADE,
            company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
            kind         TEXT NOT NULL,
            title        TEXT NOT NULL,
            body         TEXT,
            payload      JSONB,
            link_url     TEXT,
            read_at      TIMESTAMPTZ,
            dismissed_at TIMESTAMPTZ,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
            ON ratings.notifications(user_id, created_at DESC) WHERE read_at IS NULL`,
        `CREATE INDEX IF NOT EXISTS idx_notifications_company_time
            ON ratings.notifications(company_id, created_at DESC)`,

        // Allow 'custom_cron' trigger mode + add the cron column
        `ALTER TABLE ratings.alert_rules
            ADD COLUMN IF NOT EXISTS cron_expression TEXT,
            ADD COLUMN IF NOT EXISTS or_group JSONB`,

        `DO $$
         BEGIN
             IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_trigger_mode_check') THEN
                 ALTER TABLE ratings.alert_rules DROP CONSTRAINT alert_rules_trigger_mode_check;
             END IF;
             ALTER TABLE ratings.alert_rules
                 ADD CONSTRAINT alert_rules_trigger_mode_check
                 CHECK (trigger_mode IN ('on_schedule', 'on_event', 'manual_only', 'custom_cron'));
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
