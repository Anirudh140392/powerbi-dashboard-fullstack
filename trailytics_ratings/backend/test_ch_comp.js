import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT is_competitor, count() FROM ml_reviews GROUP BY is_competitor", format: 'JSONEachRow' });
    console.log("IS_COMPETITOR:");
    console.log(await res.json());

    let res2 = await clickhouse.query({ query: "SELECT sentiment_subcategory, count() FROM ml_reviews WHERE company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979' AND sentiment_subcategory != '' GROUP BY sentiment_subcategory LIMIT 5", format: 'JSONEachRow' });
    console.log("SUBCATEGORIES:");
    console.log(await res2.json());

    process.exit(0);
}
test();
