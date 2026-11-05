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
        const res = await pool.query("SELECT COUNT(*) FROM ratings.reviews WHERE sentiment_category = 'Customer Service' AND review_date >= (CURRENT_DATE - INTERVAL '6 months')");
        console.log('Customer Service reviews in last 6 months:', res.rows[0].count);
        
        const res2 = await pool.query("SELECT COUNT(*) FROM ratings.reviews WHERE sentiment_category = 'Customer Service' AND review_date >= (CURRENT_DATE - INTERVAL '6 months') AND is_competitor = true");
        console.log('Competitor Customer Service reviews in last 6 months:', res2.rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
