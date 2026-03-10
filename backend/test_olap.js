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
        console.log("Checking pdp_olap for brand_crawl competitors:");
        const res1 = await queryClickHouse("SELECT toDate(DATE) as date_key, COUNT(*) as cnt FROM rb_pdp_olap WHERE toDate(DATE) >= '2025-12-07' AND toDate(DATE) <= '2026-03-07' AND Brand = 'Ferrero' GROUP BY date_key LIMIT 5");
        console.log(res1);

        const res2 = await queryClickHouse("SELECT toDate(DATE) as date_key, COUNT(*) as cnt FROM rb_pdp_olap WHERE toDate(DATE) >= '2025-12-07' AND toDate(DATE) <= '2026-03-07' AND toString(Comp_flag) = '1' AND Brand = 'Ferrero' GROUP BY date_key LIMIT 5");
        console.log(res2);

        const res3 = await queryClickHouse("SELECT DISTINCT Brand FROM rb_pdp_olap WHERE toDate(DATE) >= '2025-12-07' AND toDate(DATE) <= '2026-03-07' AND toString(Comp_flag) = '1'");
        console.log(res3);
    } catch(e) {
        console.error(e);
    }
}
test();
