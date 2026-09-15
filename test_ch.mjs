import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function main() {
    const res = await clickhouse.query({
        database: 'danone',
        query: 'SELECT DISTINCT company_id FROM products',
        format: 'JSONEachRow'
    }).then(r => r.json());
    console.log("products company ids:", res);

    const res2 = await clickhouse.query({
        database: 'danone',
        query: "SELECT count() FROM products WHERE company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b'",
        format: 'JSONEachRow'
    }).then(r => r.json());
    console.log("products count fb06:", res2);
}
main().catch(console.error);
