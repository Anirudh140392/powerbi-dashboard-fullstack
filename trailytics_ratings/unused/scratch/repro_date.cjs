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
        const companyId = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
        const sentiment = 'Customer Service';
        const is_competitor = true;
        
        const res = await pool.query("SELECT COUNT(*) FROM ratings.reviews WHERE company_id = $1 AND is_competitor = $2 AND sentiment_category = $3 AND review_date >= (CURRENT_DATE - INTERVAL '6 months')", [companyId, is_competitor, sentiment]);
        console.log('CS + Competition in last 6 months:', res.rows[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
