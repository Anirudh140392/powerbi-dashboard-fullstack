import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function checkCintholCrawl() {
    try {
        const result = await clickhouse.query({
            query: "SELECT brand_crawl, keyword_is_rb_product, count() as cnt FROM colpal.rb_kw WHERE brand_crawl LIKE '%Cinthol%' GROUP BY brand_crawl, keyword_is_rb_product",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.table(data);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

checkCintholCrawl();
