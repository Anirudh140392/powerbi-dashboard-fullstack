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
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'ratings' AND table_name = 'product_snapshots' AND column_name = 'is_competitor'");
        console.log('is_competitor exists in product_snapshots:', res.rowCount > 0);
        
        if (res.rowCount > 0) {
            const res2 = await pool.query("SELECT is_competitor, COUNT(*) FROM ratings.product_snapshots GROUP BY is_competitor");
            console.log('product_snapshots by is_competitor:', res2.rows);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
