/**
 * Password-reset purpose — extends auth_sessions.purpose to include
 * 'password_reset' so the same table holds the short-lived single-use
 * tokens emailed to the user when they click "Forgot password".
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
        // Drop and recreate the CHECK so 'password_reset' is allowed alongside the existing purposes.
        `DO $$
         BEGIN
             IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_sessions_purpose_check') THEN
                 ALTER TABLE ratings.auth_sessions DROP CONSTRAINT auth_sessions_purpose_check;
             END IF;
             ALTER TABLE ratings.auth_sessions
                 ADD CONSTRAINT auth_sessions_purpose_check
                 CHECK (purpose IN ('full', 'mfa_challenge', 'mfa_enrolment', 'password_reset'));
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
