import { createClient } from '@clickhouse/client';
import 'dotenv/config';

async function checkPlatformCategories() {
    const client = createClient({
        url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
        database: 'mars',
    });

    try {
        const platforms = ['Blinkit', 'Zepto', 'Instamart'];
        for (const p of platforms) {
            console.log(`\n--- ${p} Top 10 keyword_category ---`);
            const res = await client.query({
                query: `SELECT keyword_category, count() as cnt FROM rb_kw WHERE platform_name = '${p}' AND keyword_category IS NOT NULL AND keyword_category != '' GROUP BY keyword_category ORDER BY cnt DESC LIMIT 10`,
                format: 'JSONEachRow'
            });
            console.table(await res.json());
        }

        console.log(`\n--- Top 10 brand_crawl for All ---`);
        const resBrand = await client.query({
            query: `SELECT brand_crawl, count() as cnt FROM rb_kw WHERE brand_crawl IS NOT NULL AND brand_crawl != '' GROUP BY brand_crawl ORDER BY cnt DESC LIMIT 10`,
            format: 'JSONEachRow'
        });
        console.table(await resBrand.json());

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await client.close();
    }
}

checkPlatformCategories();
