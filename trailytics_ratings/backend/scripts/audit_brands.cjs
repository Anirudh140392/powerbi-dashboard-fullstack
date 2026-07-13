const { Pool } = require('pg');
require('dotenv').config();

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

const pool = new Pool({
    host: requireEnv('DB_HOST'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(requireEnv('DB_PORT'), 10),
    ssl: { rejectUnauthorized: false },
});

async function run() {
    const companyId = requireEnv('COMPANY_ID');
    const res = await pool.query(
        `SELECT sentiment_category, COUNT(*) as cnt
         FROM ratings.reviews
         WHERE company_id = $1 AND is_competitor = false
         GROUP BY sentiment_category
         ORDER BY cnt DESC
         LIMIT 20`,
        [companyId]
    );
    console.log('=== Own-brand sentiment_category distribution ===');
    res.rows.forEach(r => console.log(`${r.cnt} | ${JSON.stringify(r.sentiment_category)}`));

    const total = await pool.query(
        `SELECT count(*) as total, count(sentiment_category) as has_cat, count(*) - count(sentiment_category) as missing
         FROM ratings.reviews
         WHERE company_id = $1 AND is_competitor = false`,
        [companyId]
    );
    console.log('\n=== Totals ===');
    console.log(JSON.stringify(total.rows[0]));

    await pool.end();
}

run().catch(e => {
    console.error(e.message);
    process.exit(1);
});
