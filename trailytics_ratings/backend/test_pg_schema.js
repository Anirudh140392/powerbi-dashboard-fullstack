import pool from './src/config/db.js';
async function test() {
    let res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='ratings' AND table_name='reviews'");
    console.log(res.rows.map(r => r.column_name).join(', '));
    process.exit(0);
}
test();
