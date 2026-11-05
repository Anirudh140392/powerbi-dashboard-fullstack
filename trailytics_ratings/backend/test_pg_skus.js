import pool from './src/config/db.js';
async function test() {
    let res = await pool.query("SELECT web_pid, product_name FROM ratings.product_snapshots WHERE product_name ILIKE '%OGO 500W%' LIMIT 5");
    console.log("OGO in Postgres:", res.rows);

    let res2 = await pool.query("SELECT web_pid, product_name FROM ratings.product_snapshots WHERE product_name ILIKE '%Ajax%' LIMIT 5");
    console.log("Ajax in Postgres:", res2.rows);

    process.exit(0);
}
test();
