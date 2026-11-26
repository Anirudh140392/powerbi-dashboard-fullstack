import { createClient } from '@clickhouse/client';
import 'dotenv/config';

async function describeTable() {
    const db = 'mars';
    try {
        const client = createClient({
            url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || '',
            database: db,
        });

        console.log(`Describing table rb_kw in DB: ${db}`);
        const query = `DESCRIBE TABLE rb_kw`;
        const resultSet = await client.query({ query, format: 'JSONEachRow' });
        const res = await resultSet.json();
        console.table(res.map(r => ({ name: r.name, type: r.type })));

        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

describeTable();
