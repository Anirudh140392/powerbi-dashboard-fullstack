import { createClient } from '@clickhouse/client';
import 'dotenv/config';

async function checkSchemas() {
    const client = createClient({
        url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
        database: 'mars',
    });

    try {
        console.log('--- rb_kw Sample Data ---');
        const kwRes = await client.query({
            query: 'SELECT keyword_category, brand_crawl, keyword_search_product, platform_name FROM rb_kw LIMIT 5',
            format: 'JSONEachRow'
        });
        console.table(await kwRes.json());

        console.log('\n--- rb_brand_ms Sample Data ---');
        const msRes = await client.query({
            query: 'SELECT category, brand, item_name, platform FROM rb_brand_ms LIMIT 5',
            format: 'JSONEachRow'
        });
        console.table(await msRes.json());

        console.log('\n--- rb_kw Distinct keyword_category (Top 10) ---');
        const catRes = await client.query({
            query: 'SELECT keyword_category, count() as cnt FROM rb_kw WHERE keyword_category IS NOT NULL AND keyword_category != \'\' GROUP BY keyword_category ORDER BY cnt DESC LIMIT 10',
            format: 'JSONEachRow'
        });
        console.table(await catRes.json());

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await client.close();
    }
}

checkSchemas();
