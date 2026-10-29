
const { createClient } = require('@clickhouse/client');
require('dotenv').config({ path: './backend/.env' });

async function run() {
    const client = createClient({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USER,
        password: process.env.CLICKHOUSE_PASSWORD,
        database: process.env.CLICKHOUSE_DB,
    });

    try {
        const query = "SELECT brand_name, count() as cnt FROM rb_kw_olap WHERE brand_name ILIKE '%snickers%' GROUP BY brand_name ORDER BY cnt DESC";
        const result = await client.query({
            query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();
