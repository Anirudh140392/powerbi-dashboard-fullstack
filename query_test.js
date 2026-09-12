import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';
async function test() {
    const res = await clickhouse.query({
        database: 'prestige',
        query: "SELECT count() as c FROM ml_reviews WHERE sentiment_category ILIKE 'Brand'",
        format: 'JSONEachRow'
    });
    console.log(await res.json());
}
test().catch(console.error);
