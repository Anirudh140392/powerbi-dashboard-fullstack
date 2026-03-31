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
SELECT brand, platform, p_overall, b_overall, b_overall * 100.0 / nullIf(p_overall, 0) as sos
FROM (
    SELECT 
        brand, 
        platform_name AS platform, 
        sum(toInt32(overall)) as b_overall,
        SUM(sum(toInt32(overall))) OVER(PARTITION BY platform_name) as p_overall
    FROM rb_kw_olap
    WHERE DATE = '2026-03-10'
    GROUP BY brand, platform_name
)
WHERE brand = 'Cadbury' AND platform = 'Blinkit'
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
