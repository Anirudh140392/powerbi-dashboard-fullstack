const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({
    connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=require`,
});
async function test() {
    try {
        const { rows } = await pool.query("SELECT id, name FROM public.companies LIMIT 5;");
        console.log(rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
test();
