const { Pool } = require('pg');
require('dotenv').config();

const isRemoteDb = process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST);
const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

async function checkDataFreshness() {
    console.log('Connecting to:', process.env.DB_HOST);
    
    // Get company ID
    const compRes = await pool.query("SELECT company_id FROM ratings.reviews WHERE brand ILIKE '%Prestige%' LIMIT 1");
    if (compRes.rowCount === 0) {
        console.error('No Prestige data found');
        process.exit(1);
    }
    const cid = compRes.rows[0].company_id;

    // Check count of reviews in last few months
    const sql = `
        SELECT 
            COUNT(*) FILTER (WHERE review_date >= CURRENT_DATE - INTERVAL '1 month') as last_30_days,
            COUNT(*) FILTER (WHERE review_date >= CURRENT_DATE - INTERVAL '2 months' AND review_date < CURRENT_DATE - INTERVAL '1 month') as prev_30_days,
            COUNT(*) FILTER (WHERE review_date >= CURRENT_DATE - INTERVAL '3 months' AND review_date < CURRENT_DATE - INTERVAL '2 months') as months_ago_3,
            MAX(review_date) as latest_review
        FROM ratings.reviews
        WHERE company_id = $1
    `;

    const { rows } = await pool.query(sql, [cid]);
    console.log('Review Distribution for', cid, ':', rows[0]);

    pool.end();
}

checkDataFreshness().catch(console.error);
