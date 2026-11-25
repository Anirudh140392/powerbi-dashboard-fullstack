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
    keyword,
    sumIf(toInt32(overall), flag = 1) as rb_overall,
    sum(toInt32(overall)) as total_overall,
    ROUND(sumIf(toInt32(overall), flag = 1) * 100 / nullIf(sum(toInt32(overall)), 0), 1) as sos
FROM rb_kw_olap
WHERE DATE = '2026-03-10'
AND platform_name = 'Blinkit'
AND keyword = 'snickers'
AND keyword_type = 'Branded'
GROUP BY keyword
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
