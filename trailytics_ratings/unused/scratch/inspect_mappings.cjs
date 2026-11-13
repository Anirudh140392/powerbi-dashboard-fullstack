require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});

async function run() {
    const mappingTables = [
        { schema: 'ratings', table: 'competitor_mappings' },
        { schema: 'ratings', table: 'competitor_mapping_pairs' },
        { schema: 'ratings', table: 'competitor_mapping_types' },
        { schema: 'ratings', table: 'stakeholder_mappings' },
        { schema: 'ratings', table: 'sku_classifications' },
        { schema: 'public', table: 'platform_mappings' },
        { schema: 'public', table: 'sku_catalog' },
    ];

    for (const { schema, table } of mappingTables) {
        // Get columns
        const cols = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        `, [schema, table]);

        // Get row count + sample rows
        const count = await pool.query(`SELECT COUNT(*) FROM ${schema}.${table}`);
        const sample = await pool.query(`SELECT * FROM ${schema}.${table} LIMIT 3`);

        console.log(`\n=== ${schema}.${table} (${count.rows[0].count} rows) ===`);
        console.log('COLUMNS:', cols.rows.map(r => `${r.column_name}(${r.data_type})`).join(', '));
        if (sample.rows.length > 0) console.table(sample.rows);
    }

    await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
