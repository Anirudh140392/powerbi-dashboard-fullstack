import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function main() {
    const q = "SELECT * FROM products WHERE company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b' LIMIT 1";
    const res = await clickhouse.query({
        database: 'danone',
        query: q,
        format: 'JSONEachRow'
    }).then(r => r.json()).catch(e => e.message);
    console.log("products query:", res);
}
main().catch(console.error);
