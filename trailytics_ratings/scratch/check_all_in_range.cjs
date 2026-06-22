require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});

async function run() {
    const res = await pool.query(`
        SELECT ps.category, COUNT(*) FROM ratings.product_snapshots ps
        LEFT JOIN masters.products mp ON mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
        WHERE ps.company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979'
          AND COALESCE(ps.is_competitor, false) = false
          AND COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp) >= 35
          AND COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp) <= 1795
        GROUP BY ps.category
    `);
    console.table(res.rows);
    await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
