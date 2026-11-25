import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT title FROM reviews LIMIT 5", format: 'JSONEachRow' });
    console.log("Titles in reviews:");
    console.log(await res.json());

    let res2 = await clickhouse.query({ query: "SELECT product_name FROM ml_reviews LIMIT 5", format: 'JSONEachRow' });
    console.log("Titles in ml_reviews:");
    console.log(await res2.json());
    
    process.exit(0);
}
test();
