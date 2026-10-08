import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'default',
    request_timeout: 10000
});

async function run() {
    const query = `
SELECT 
    sku, num, den, ROUND(num * 100.0 / nullIf(den, 0), 2) as sos
FROM (
    SELECT 
        keyword_search_product as sku,
        sumIf(toInt32(overall), flag = 1) as num,
        SUM(sum(toInt32(overall))) OVER() as den
    FROM rb_kw_olap
    WHERE DATE = '2026-03-10' AND platform_name = 'Blinkit'
    AND keyword_search_product != ''
    GROUP BY sku
)
WHERE sku = 'Snickers Best of Minis Assorted Chocolate Pack'
    `;
    console.log("Running Query:\n" + query);
    try {
        const rs = await client.query({ query, format: 'JSONEachRow' });
        const data = await rs.json();
        console.log("Result:", data);
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}
run();
