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
        // Mock company_id (I'll try to find one or use a common one)
        const companyRes = await pool.query("SELECT company_id FROM ratings.reviews LIMIT 1");
        const companyId = companyRes.rows[0].company_id;
        console.log('Using companyId:', companyId);

        // Mock parameters for Category Health
        const sentiment = 'Customer Service';
        const is_competitor = true; // Competition scope
        
        // Check if reviews exist for this combo
        const countRes = await pool.query("SELECT COUNT(*) FROM ratings.reviews WHERE company_id = $1 AND is_competitor = $2 AND sentiment_category = $3", [companyId, is_competitor, sentiment]);
        console.log('Reviews for CS + Competition:', countRes.rows[0].count);

        // Check if categories exist for this combo
        const catRes = await pool.query("SELECT category, COUNT(*) FROM ratings.reviews WHERE company_id = $1 AND is_competitor = $2 AND sentiment_category = $3 GROUP BY category", [companyId, is_competitor, sentiment]);
        console.log('Categories for CS + Competition:', catRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
