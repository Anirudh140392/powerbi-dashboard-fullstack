
require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@clickhouse/client');

async function test() {
    const client = createClient({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USER,
        password: process.env.CLICKHOUSE_PASSWORD,
        database: 'mars'
    });

    try {
        const query = `SELECT DISTINCT Product_Category as category FROM rb_pdp_olap WHERE Product_Category IS NOT NULL ORDER BY category ASC`;
        const result = await client.query({
            query: query,
            format: 'JSONEachRow',
        });
        const rows = await result.json();
        console.log("Fetched Categories from ClickHouse directly:", rows.map(r => r.category));
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
