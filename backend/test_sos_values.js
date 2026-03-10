import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

const queryClickHouse = async (query) => {
    const rs = await clickhouse.query({ query, format: 'JSONEachRow' });
    return await rs.json();
};

async function test() {
    try {
        const brands = ["ferrero", "amul", "chupa chups", "nestle", "happydent", "mentos", "sour punk", "cadbury", "hershey's", "fabelle"];
        
        for (let b of brands) {
            const res = await queryClickHouse(`SELECT SUM(cnt) as brand_kw FROM (SELECT COUNT(*) as cnt FROM rb_kw WHERE toDate(created_on) >= '2025-12-07' AND toDate(created_on) <= '2026-03-07' AND keyword_search_rank < 11 AND lower(platform_name) IN ('blinkit') AND lower(brand_crawl) = '${b.replace(/'/g, "''")}')`);
            console.log(`Brand: ${b}, KW: ${res[0].brand_kw}`);
        }
    } catch(e) {
        console.error(e);
    }
}
test();
