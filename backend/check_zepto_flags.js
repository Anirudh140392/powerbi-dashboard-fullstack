import { createClient } from '@clickhouse/client';
import 'dotenv/config';

async function checkZeptoFlags() {
    const db = 'mars';
    try {
        const client = createClient({
            url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || '',
            database: db,
        });

        console.log(`Checking Zepto Flags in DB: ${db}`);
        const query = `
            SELECT 
                keyword_is_rb_product, 
                count() as cnt 
            FROM rb_kw 
            WHERE platform_name = 'Zepto'
            GROUP BY keyword_is_rb_product
        `;
        const resultSet = await client.query({ query, format: 'JSONEachRow' });
        const res = await resultSet.json();
        console.table(res);

        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkZeptoFlags();
