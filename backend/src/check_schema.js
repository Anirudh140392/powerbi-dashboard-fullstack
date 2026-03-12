import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

async function getSchema() {
    try {
        console.log('--- rb_pdp_olap schema ---');
        const result1 = await client.query({
            query: 'DESCRIBE TABLE rb_pdp_olap',
            format: 'JSONEachRow',
        });
        const data1 = await result1.json();
        console.log(JSON.stringify(data1, null, 2));

        console.log('\n--- watchtower_agg_daily schema ---');
        try {
            const result2 = await client.query({
                query: 'DESCRIBE TABLE watchtower_agg_daily',
                format: 'JSONEachRow',
            });
            const data2 = await result2.json();
            console.log(JSON.stringify(data2, null, 2));
        } catch (e) {
            console.log('watchtower_agg_daily table not found');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.close();
    }
}

getSchema();
