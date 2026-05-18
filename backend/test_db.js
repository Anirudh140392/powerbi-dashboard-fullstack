import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
  url: 'http://localhost:8123',
});

async function run() {
    try {
        const resultSet = await clickhouse.query({
            query: "SELECT toDate(DATE) as d, sum(toInt32(overall)) as total_overall FROM rb_kw_olap WHERE toDate(DATE) >= '2026-02-15' AND lower(platform_name) LIKE '%amazon%' GROUP BY d ORDER BY d LIMIT 10",
            format: 'JSONEachRow',
        });
        const dataset = await resultSet.json();
        console.log(dataset);
    } catch (e) {
        console.error(e);
    }
}
run();
