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
        const d1 = await queryClickHouse("SELECT toDate(DATE) as date_key, COUNT(*) as cnt FROM rb_pdp_olap WHERE toDate(DATE) >= '2025-12-07' AND toDate(DATE) <= '2026-03-07' AND Brand = 'Ferrero' GROUP BY date_key LIMIT 3");
        console.log("OLAP date formats:");
        console.log(d1);

        const d2 = await queryClickHouse("SELECT toDate(created_on) as date_key, COUNT(*) as cnt FROM rb_kw WHERE toDate(created_on) >= '2025-12-07' AND toDate(created_on) <= '2026-03-07' AND lower(brand_crawl) = 'ferrero' GROUP BY date_key LIMIT 3");
        console.log("KW date formats:");
        console.log(d2);

        const targetKwMap = new Map(d2.map(r => [
            String(r.date_key),
            parseFloat(r.cnt || 0)
        ]));

        console.log("Testing Map for Ferrero:");
        for (let row of d1) {
            console.log(row.date_key, targetKwMap.get(String(row.date_key)));
        }
    } catch(e) {
        console.error(e);
    }
}
test();
