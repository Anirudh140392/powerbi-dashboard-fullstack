/**
 * MFA schema migration — TOTP secrets, backup codes, audit log, and a
 * `purpose` column on auth_sessions so the same table holds both the
 * short-lived MFA challenge tokens and the post-MFA full session tokens.
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
            ? { rejectUnauthorized: false }
            : false,
    });

    const statements = [
        // ratings.users — TOTP secret + lockout state (reuses existing mfa_enabled column)
        `ALTER TABLE ratings.users
            ADD COLUMN IF NOT EXISTS mfa_secret           TEXT,
            ADD COLUMN IF NOT EXISTS mfa_enrolled_at      TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS mfa_last_used_code   TEXT,
            ADD COLUMN IF NOT EXISTS mfa_last_used_at     TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS mfa_failed_attempts  INT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS mfa_locked_until     TIMESTAMPTZ`,

        // Backup codes — bcrypt hashes; plaintext shown to user exactly once at enrolment
        `CREATE TABLE IF NOT EXISTS ratings.mfa_backup_codes (
            id          SERIAL PRIMARY KEY,
            user_id     UUID NOT NULL REFERENCES ratings.users(id) ON DELETE CASCADE,
            code_hash   TEXT NOT NULL,
            used_at     TIMESTAMPTZ,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_mfa_backup_unused
            ON ratings.mfa_backup_codes(user_id) WHERE used_at IS NULL`,

        // auth_sessions.purpose — same table for full sessions AND short-lived MFA challenges
        `ALTER TABLE ratings.auth_sessions
            ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'full'`,
        // CHECK constraint added separately so the column-add above stays idempotent
        // (CHECK can't ride on ADD COLUMN IF NOT EXISTS cleanly across re-runs).
        `DO $$
         BEGIN
             IF NOT EXISTS (
                 SELECT 1 FROM pg_constraint WHERE conname = 'auth_sessions_purpose_check'
             ) THEN
                 ALTER TABLE ratings.auth_sessions
                     ADD CONSTRAINT auth_sessions_purpose_check
                     CHECK (purpose IN ('full', 'mfa_challenge', 'mfa_enrolment'));
             END IF;
         END $$`,
        `CREATE INDEX IF NOT EXISTS idx_auth_sessions_purpose
            ON ratings.auth_sessions(purpose) WHERE revoked_at IS NULL`,

        // Audit trail — every enrol/verify/reset event for compliance + debugging lockouts
        `CREATE TABLE IF NOT EXISTS ratings.mfa_audit_log (
            id          BIGSERIAL PRIMARY KEY,
            user_id     UUID REFERENCES ratings.users(id) ON DELETE SET NULL,
            event       TEXT NOT NULL,
            ip_address  INET,
            user_agent  TEXT,
            actor_id    UUID,
            metadata    JSONB,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_mfa_audit_user_time
            ON ratings.mfa_audit_log(user_id, created_at DESC)`,
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
