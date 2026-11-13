import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: 'DESCRIBE TABLE ml_reviews', format: 'JSONEachRow' });
    console.log("ML_REVIEWS:");
    console.log(await res.json());
    process.exit(0);
}
test();
