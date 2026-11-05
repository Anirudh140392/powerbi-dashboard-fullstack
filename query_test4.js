import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';
async function test() {
    const res = await clickhouse.query({
        database: 'prestige',
        query: "SELECT count() as c FROM ml_reviews WHERE sentiment_category ILIKE 'Brand' AND company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979' AND review_date >= subtractMonths(today(), 6)",
        format: 'JSONEachRow'
    });
    console.log(await res.json());
}
test().catch(console.error);
