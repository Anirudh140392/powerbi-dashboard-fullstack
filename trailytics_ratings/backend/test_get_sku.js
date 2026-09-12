import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT web_pid, count() as cnt FROM ml_reviews WHERE company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979' AND sentiment_subcategory != '' GROUP BY web_pid ORDER BY cnt DESC LIMIT 1", format: 'JSONEachRow' });
    console.log(await res.json());
    process.exit(0);
}
test();
