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

        console.log(`Checking Max Dates in DB: ${db}`);
        const query = `
            SELECT 
                platform_name,
                MAX(toDate(created_on)) as max_date,
                count() as total_rows
            FROM rb_kw 
            GROUP BY platform_name
            ORDER BY max_date DESC
        `;
        const resultSet = await client.query({ query, format: 'JSONEachRow' });
        const res = await resultSet.json();
        console.log('Date Distribution by Platform:');
        console.table(res);

        const globalMaxQuery = `SELECT MAX(toDate(created_on)) as globalMax FROM rb_kw`;
        const globalMaxSet = await client.query({ query: globalMaxQuery, format: 'JSONEachRow' });
        const globalMaxRes = await globalMaxSet.json();
        console.log('Global Max Date:', globalMaxRes[0].globalMax);

        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkDate();
