const { Pool } = require('pg');
require('dotenv').config({path: './.env'});
async function test() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: { rejectUnauthorized: false }
    });
    
    const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'ratings' AND table_name = 'mfa_audit_log' AND column_name = 'metadata'
    `);
    console.log(res.rows);
    pool.end();
}
test();
