import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function testKwSimple() {
    try {
        const start = Date.now();
        const result = await clickhouse.query({
            query: "SELECT kw_data_id FROM rb_kw LIMIT 1",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('Data:', data);
        console.log(`Query took ${Date.now() - start}ms`);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

testKwSimple();
