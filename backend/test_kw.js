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
        console.log("Total KW:");
        const res1 = await queryClickHouse("SELECT toDate(created_on) as date_key, COUNT(*) as cnt FROM rb_kw_olap WHERE toDate(created_on) >= '2025-12-07' AND toDate(created_on) <= '2026-03-07' AND keyword_search_rank < 11 AND lower(platform_name) IN ('blinkit') GROUP BY date_key LIMIT 5");
        console.log(res1);

        console.log("Target KW Ferrero (using lower(brand_name)):");
        const res2 = await queryClickHouse("SELECT toDate(created_on) as date_key, COUNT(*) as cnt FROM rb_kw_olap WHERE toDate(created_on) >= '2025-12-07' AND toDate(created_on) <= '2026-03-07' AND keyword_search_rank < 11 AND lower(platform_name) IN ('blinkit') AND lower(brand_name) = 'ferrero' GROUP BY date_key LIMIT 5");
        console.log(res2);

        console.log("Target KW Ferrero (using lower(brand_crawl)):");
        const res2a = await queryClickHouse("SELECT toDate(created_on) as date_key, COUNT(*) as cnt FROM rb_kw_olap WHERE toDate(created_on) >= '2025-12-07' AND toDate(created_on) <= '2026-03-07' AND keyword_search_rank < 11 AND lower(platform_name) IN ('blinkit') AND lower(brand_crawl) = 'ferrero' GROUP BY date_key LIMIT 5");
        console.log(res2a);

        console.log("Distinct brand_names:");
        const res3 = await queryClickHouse("SELECT DISTINCT brand_name FROM rb_kw_olap WHERE toDate(created_on) >= '2025-12-07' AND toDate(created_on) <= '2026-03-07' AND keyword_search_rank < 11 AND lower(platform_name) IN ('blinkit') AND brand_name != '' LIMIT 10");
        console.log(res3);

        console.log("Distinct brand_crawl:");
        const res4 = await queryClickHouse("SELECT DISTINCT brand_crawl FROM rb_kw_olap WHERE toDate(created_on) >= '2025-12-07' AND toDate(created_on) <= '2026-03-07' AND keyword_search_rank < 11 AND lower(platform_name) IN ('blinkit') AND brand_crawl != '' LIMIT 10");
        console.log(res4);
    } catch (e) {
        console.error(e);
    }
}
test();
