import { createClient } from '@clickhouse/client';
import 'dotenv/config';

async function checkData() {
    const db = 'mars';
    try {
        const client = createClient({
            url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || '',
            database: db,
        });

        console.log(`Checking DB: ${db}`);
        const query = `
            SELECT 
                platform_name, 
                count() as cnt 
            FROM rb_kw 
            WHERE keyword_is_rb_product = 0
            GROUP BY platform_name 
            ORDER BY cnt DESC 
            LIMIT 10
        `;
        const resultSet = await client.query({ query, format: 'JSONEachRow' });
        const res = await resultSet.json();
        console.log('Platforms for non-RB products:');
        console.table(res);

        const query2 = `
            SELECT 
                is_competitor_product, 
                count() as cnt 
            FROM rb_kw 
            WHERE keyword_is_rb_product = 0
            GROUP BY is_competitor_product
        `;
        const resultSet2 = await client.query({ query2, format: 'JSONEachRow' });
        const res2 = await resultSet2.json();
        console.log('is_competitor_product distribution for non-RB products:');
        console.table(res2);

        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkData();
