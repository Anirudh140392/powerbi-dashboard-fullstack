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
        console.log("Checking total keyword search Denominator:");
        const res5 = await queryClickHouse("SELECT toDate(created_on) as date_key, COUNT(*) as cnt FROM rb_kw_olap WHERE toDate(created_on) >= '2025-12-07' AND toDate(created_on) <= '2026-03-07' AND keyword_search_rank < 11 GROUP BY date_key LIMIT 3");
        console.log(res5);
    } catch (e) {
        console.error(e);
    }
}
test();
