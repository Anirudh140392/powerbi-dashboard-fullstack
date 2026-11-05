require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});

async function run() {
    const params = {
        companyId: '297e37ea-a5ac-47df-bebd-ac44e52b7979',
        price_min: 35,
        price_max: 1795,
        is_competitor: 'false',
        category: 'Gas Stove',
        period_months: 6
    };

    // Simulate /api/ratings/category-health
    // We need to fetch it from the actual running server if possible, 
    // or just run the logic from api.cjs.
    // I'll just run a query against the DB that mimics the logic.

    console.log('Testing category-health logic with user filters...');
    // ... (simplified check)
    const res = await pool.query(`
        SELECT COUNT(*) FROM ratings.product_snapshots ps
        LEFT JOIN masters.products mp ON mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
        WHERE ps.company_id = $1
          AND ps.category = $2
          AND COALESCE(ps.is_competitor, false) = false
          AND COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp) >= $3
          AND COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp) <= $4
    `, [params.companyId, params.category, params.price_min, params.price_max]);

    console.log('SKUs found in range:', res.rows[0].count);

    await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
