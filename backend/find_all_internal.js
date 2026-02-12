import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function findAllInternal() {
    try {
        const result = await clickhouse.query({
            query: "SELECT DISTINCT brand_name FROM rb_kw WHERE keyword_is_rb_product = 1",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('ALL Brands where keyword_is_rb_product = 1:');
        console.table(data);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

findAllInternal();
