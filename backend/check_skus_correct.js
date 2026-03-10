import { createClient } from '@clickhouse/client';
import 'dotenv/config';

async function checkSkus() {
    const db = 'mars';
    try {
        const client = createClient({
            url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || '',
            database: db,
        });

        console.log(`Checking competitor products in DB: ${db}`);
        const query = `
            SELECT 
                platform_name,
                keyword_search_product, 
                count() as cnt 
            FROM rb_kw 
            WHERE keyword_is_rb_product = 0
            GROUP BY platform_name, keyword_search_product
            ORDER BY cnt DESC 
            LIMIT 50
        `;
        const resultSet = await client.query({ query, format: 'JSONEachRow' });
        const res = await resultSet.json();
        console.table(res);

        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkSkus();
