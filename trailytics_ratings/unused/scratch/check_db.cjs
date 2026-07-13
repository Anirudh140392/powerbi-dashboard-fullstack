require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST) ? { rejectUnauthorized: false } : false,
});

async function run() {
    try {
        const res = await pool.query('SELECT is_competitor, COUNT(*) FROM ratings.reviews GROUP BY is_competitor');
        console.log('Reviews table counts:', res.rows);
        
        const res2 = await pool.query('SELECT is_competitor, COUNT(*) FROM ratings.product_snapshots GROUP BY is_competitor');
        console.log('Product snapshots table counts:', res2.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
