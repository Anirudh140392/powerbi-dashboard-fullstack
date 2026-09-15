import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function main() {
    const q = "SELECT max(review_date) as max_date, min(review_date) as min_date FROM ml_reviews WHERE company_id = 'fb064e5d-7e70-4cf1-b09b-e2428d8a1c9b'";
    const res = await clickhouse.query({
        database: 'danone',
        query: q,
        format: 'JSONEachRow'
    }).then(r => r.json()).catch(e => e.message);
    console.log("ml_reviews dates:", res);
}
main().catch(console.error);
