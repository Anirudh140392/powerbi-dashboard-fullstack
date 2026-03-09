import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function testById() {
    try {
        const start = Date.now();
        // Since we know kw_data_id 1 existed from our schema check row sample
        const result = await clickhouse.query({
            query: "SELECT kw_data_id, brand_name, created_on FROM rb_kw WHERE kw_data_id = 1",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('Result:', data);
        console.log(`Query took ${Date.now() - start}ms`);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

testById();
