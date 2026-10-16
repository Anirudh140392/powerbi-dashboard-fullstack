import pool from '../src/config/db.js';

async function test() {
    try {
        console.log("Querying ratings.company_config:");
        const columns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'ratings' AND table_name = 'company_config'
        `);
        console.log("columns:", columns.rows);

        const rows = await pool.query(`SELECT * FROM ratings.company_config LIMIT 5`);
        console.log("content:", rows.rows);
    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}

test();
