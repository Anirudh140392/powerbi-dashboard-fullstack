import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function main() {
    const q = "SELECT count() FROM product_snapshots WHERE company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b'";
    const res = await clickhouse.query({
        database: 'danone',
        query: q,
        format: 'JSONEachRow'
    }).then(r => r.json()).catch(e => e.message);
    console.log("product_snapshots count:", res);
}
main().catch(console.error);
