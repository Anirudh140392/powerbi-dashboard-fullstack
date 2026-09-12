import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'default'
});

async function run() {
    const query = `
SELECT
    keyword,
    MAX(keyword_type) as type,
    sumIf(toInt32(overall), (1=1 AND toInt32(flag) = 1)) as rb_overall,
    sumIf(toInt32(organic), (1=1 AND toInt32(flag) = 1)) as rb_organic,
    sumIf(toInt32(spons), (1=1 AND toInt32(flag) = 1)) as rb_sponsored,
    sumIf(toInt32(overall), toInt32(flag) = 1) as total_overall,
    sumIf(toInt32(organic), toInt32(flag) = 1) as total_organic,
    sumIf(toInt32(spons), toInt32(flag) = 1) as total_spons,
    sumIf(toInt32(overall), (1=1 AND toInt32(flag) = 1)) as brand_filter_overall,
    ROUND(AVG(POSITION), 1) as avg_overall_pos,
    ROUND(avgIf(POSITION, toInt32(organic) = 1 AND (1=1 AND toInt32(flag) = 1)), 1) as avg_org_pos,
    ROUND(avgIf(POSITION, toInt32(spons) = 1 AND (1=1 AND toInt32(flag) = 1)), 1) as avg_ad_pos
FROM rb_kw_olap
WHERE DATE = '2026-03-10'
AND platform_name = 'Blinkit'
AND keyword = 'snickers'
GROUP BY keyword
    `;
    console.log("Running Query:\n" + query);
    try {
        const rs = await client.query({ query, format: 'JSONEachRow' });
        const data = await rs.json();
        console.log("Result:", data);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
