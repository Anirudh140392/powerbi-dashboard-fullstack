import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

async function checkBrands() {
    try {
        console.log('Checking brands in rb_pdp_olap...');

        const brandRes = await client.query({
            query: 'SELECT Brand, count() as count FROM rb_pdp_olap GROUP BY Brand ORDER BY count DESC',
            format: 'JSONEachRow'
        });
        const brands = await brandRes.json();
        console.log('Brands distribution:', JSON.stringify(brands.slice(0, 10), null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

checkBrands();
