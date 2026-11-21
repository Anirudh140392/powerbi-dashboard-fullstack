require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});

async function run() {
    const tables = [
        { schema: 'ratings', table: 'reviews' },
        { schema: 'ratings', table: 'product_snapshots' },
        { schema: 'masters', table: 'products' },
    ];

    for (const { schema, table } of tables) {
        const cols = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        `, [schema, table]);
        console.log(`\n=== ${schema}.${table} ===`);
        console.log('COLUMNS:', cols.rows.map(r => `${r.column_name}(${r.data_type})`).join(', '));
    }

    // Check a few rows for "Gas Stove" category
    const res = await pool.query(`
        SELECT category, COUNT(*) FROM ratings.product_snapshots
        WHERE company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979'
        GROUP BY category
    `);
    console.log('\nCategories in snapshots:');
    console.table(res.rows);

    await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
