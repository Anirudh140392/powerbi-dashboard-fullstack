import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function showCreate() {
    try {
        const result = await clickhouse.query({
            query: "SHOW CREATE TABLE rb_kw",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log(data[0].statement);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

showCreate();
