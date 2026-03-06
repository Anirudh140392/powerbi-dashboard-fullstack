
import 'dotenv/config';
import { createClient } from '@clickhouse/client';

async function run() {
    const client = createClient({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USER,
        password: process.env.CLICKHOUSE_PASSWORD,
        database: process.env.CLICKHOUSE_DB,
    });

    try {
        const result = await client.query({
            query: 'SHOW TABLES',
            format: 'JSONEachRow',
        });
        const tables = await result.json();
        console.log('Tables:');
        tables.forEach(t => console.log(Object.values(t)[0]));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

run();
