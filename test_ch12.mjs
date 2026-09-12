import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function main() {
    const q = "SELECT multiIf(trim(lower(category)) IN ('other','others'), 'Others', initcap(trim(category))) AS category, count(DISTINCT product_external_id) AS count FROM products WHERE company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b' AND platform != '' AND category != '' GROUP BY 1 ORDER BY 2 DESC";
    const res = await clickhouse.query({
        database: 'danone',
        query: q,
        format: 'JSONEachRow'
    }).then(r => r.json()).catch(e => e.message);
    console.log("product_categories exact query:", res);
}
main().catch(console.error);
