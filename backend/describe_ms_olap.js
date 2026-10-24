
import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function describeTable() {
    try {
        const result = await clickhouse.query({
            query: 'DESCRIBE TABLE rb_ms_olap',
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log(JSON.stringify(data, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

describeTable();
