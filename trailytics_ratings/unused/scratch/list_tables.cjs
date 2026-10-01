require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: 5432, ssl: { rejectUnauthorized: false }
});

pool.query(`
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog','information_schema','silver','staging','system')
    ORDER BY table_schema, table_name
`).then(r => {
    console.table(r.rows);
    pool.end();
}).catch(e => {
    console.error(e.message);
    pool.end();
});
