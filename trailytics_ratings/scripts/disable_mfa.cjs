require('dotenv').config({ path: __dirname + '/../.env' });
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

    try {
        const res = await pool.query(`
            UPDATE ratings.users
            SET mfa_enabled = false,
                mfa_secret = NULL,
                mfa_enrolled_at = NULL,
                mfa_last_used_code = NULL,
                mfa_last_used_at = NULL,
                mfa_failed_attempts = 0,
                mfa_locked_until = NULL
        `);
        console.log(`Successfully disabled MFA for ${res.rowCount} users.`);
        
        await pool.query(`DELETE FROM ratings.mfa_backup_codes`);
        console.log(`Cleared backup codes.`);
    } catch (e) {
        console.error('Error disabling MFA:', e);
    } finally {
        await pool.end();
    }
})();
