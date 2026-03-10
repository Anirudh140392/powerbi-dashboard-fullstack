import { createClient } from '@clickhouse/client';
import 'dotenv/config';

async function checkDate() {
    const db = 'mars';
    try {
        const client = createClient({
            url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || '',
            database: db,
        });

        console.log(`Checking Global vs Platform Max Date in DB: ${db}`);
        const query = `
            SELECT 
                MAX(toDate(created_on)) as global_max,
                MAX(toDate(created_on)) filter (WHERE platform_name = 'Zepto') as zepto_max,
                MAX(toDate(created_on)) filter (WHERE platform_name = 'Blinkit') as blinkit_max
            FROM rb_kw 
        `;
        const resultSet = await client.query({ query, format: 'JSONEachRow' });
        const res = await resultSet.json();
        console.table(res);

        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkDate();
