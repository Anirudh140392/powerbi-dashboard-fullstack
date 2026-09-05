/**
 * Issue statuses table — DB backing for the previously-localStorage-only
 * status state in ActionIntelligenceHub (the open/in_progress/resolved
 * triage chip on each issue card in the Explorer → Action Board).
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
        port: process.env.DB_PORT || 5432,
    });

    const statements = [
        `CREATE TABLE IF NOT EXISTS ratings.issue_statuses (
            id          SERIAL PRIMARY KEY,
            company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            issue_key   TEXT NOT NULL,
            status      TEXT NOT NULL CHECK (status IN ('open','in_progress','resolved')),
            updated_by  UUID,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_issue_status_company_key
            ON ratings.issue_statuses (company_id, issue_key)`,
        `CREATE INDEX IF NOT EXISTS idx_issue_status_updated
            ON ratings.issue_statuses (company_id, updated_at DESC)`,
    ];

    for (const sql of statements) {
        const t = Date.now();
        const name = sql.split('\n')[0].slice(0, 70);
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
