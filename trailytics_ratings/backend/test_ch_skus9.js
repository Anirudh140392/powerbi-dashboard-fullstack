import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT count() FROM ml_reviews WHERE is_competitor IS NULL", format: 'JSONEachRow' });
    console.log("NULL is_competitor:", await res.json());

    process.exit(0);
}
test();
