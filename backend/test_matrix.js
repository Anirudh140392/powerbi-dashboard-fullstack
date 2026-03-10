import { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import dayjs from 'dayjs';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'default',
});

async function run() {
    try {
        const query = `
            SELECT 
                platform_name as name,
                ROUND(countIf(toString(keyword_is_rb_product) = '1') * 100.0 / nullIf(count(), 0), 1) AS overall_sos,
                ROUND(countIf(toString(keyword_is_rb_product) = '1' AND toString(spons_flag) = '1') * 100.0 / nullIf(count(), 0), 1) AS sponsored_sos,
                ROUND(countIf(toString(keyword_is_rb_product) = '1' AND toString(spons_flag) != '1') * 100.0 / nullIf(count(), 0), 1) AS organic_sos,
                ROUND(countIf(toString(keyword_is_rb_product) = '1' AND (toDate(created_on) < '2025-01-01' OR spons_flag = '1')) * 100.0 / nullIf(count(), 0), 1) AS display_sos
            FROM rb_kw_olap
            WHERE toDate(created_on) BETWEEN '2024-01-01' AND '2025-12-31' AND keyword_search_rank < 11 AND platform_name IS NOT NULL AND platform_name != ''
            GROUP BY platform_name
            ORDER BY count() DESC
            LIMIT 15
        `;
        const resultSet = await client.query({ query, format: 'JSONEachRow' });
        const data = await resultSet.json();
        console.log("Data:", data);
    } catch (e) {
        console.error(e);
    }
}
run();
