import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { createClient } from '@clickhouse/client';

async function testSelect1() {
    try {
        console.log('Connecting to:', process.env.CLICKHOUSE_URL);
        const client = createClient({
            url: process.env.CLICKHOUSE_URL,
            username: process.env.CLICKHOUSE_USER,
            password: process.env.CLICKHOUSE_PASSWORD,
            database: process.env.CLICKHOUSE_DB,
        });

        const result = await client.query({
            query: 'SELECT 1 as val',
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('Result:', JSON.stringify(data, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

testSelect1();
