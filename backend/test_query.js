import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    const res = await queryClickHouse(`
        SELECT brand_crawl, count() as count 
        FROM rb_kw 
        WHERE keyword = 'Pepsodent'
          AND brand_crawl IS NOT NULL
          AND brand_crawl != ''
        GROUP BY brand_crawl 
        ORDER BY count DESC 
        LIMIT 5
    `);
    console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
