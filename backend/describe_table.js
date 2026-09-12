
import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function describeTable() {
    try {
        console.log('Using URL:', process.env.CLICKHOUSE_URL);
        console.log('Using User:', process.env.CLICKHOUSE_USER);

        const result = await clickhouse.query({
            query: 'DESCRIBE TABLE rb_pdp_olap',
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
