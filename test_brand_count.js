import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function test() {
    try {
        const res = await clickhouse.query({
            database: 'prestige',
            query: `SELECT count() as c FROM ml_reviews WHERE sentiment_category ILIKE 'Brand' AND company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979' AND review_date >= subtractMonths(today(), 6)`,
            format: 'JSONEachRow'
        });
        console.log("6 months brand count:", await res.json());
        
        const res2 = await clickhouse.query({
            database: 'prestige',
            query: `SELECT count() as c FROM ml_reviews WHERE sentiment_category ILIKE 'Brand' AND company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979'`,
            format: 'JSONEachRow'
        });
        console.log("Total brand count:", await res2.json());
        
        const res3 = await clickhouse.query({
            database: 'prestige',
            query: `SELECT sentiment_category, count() as c FROM ml_reviews WHERE company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979' GROUP BY sentiment_category`,
            format: 'JSONEachRow'
        });
        console.log("Sentiment distribution:", await res3.json());
    } catch(e) {
        console.error("ERROR:", e.message);
    }
}
test().catch(console.error);
