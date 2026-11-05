import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT web_pid, product_name, count() FROM ml_reviews WHERE product_name ILIKE '%Prestige OGO 500W%' GROUP BY web_pid, product_name", format: 'JSONEachRow' });
    console.log("OGO:");
    console.log(await res.json());

    res = await clickhouse.query({ query: "SELECT web_pid, product_name, count() FROM ml_reviews WHERE product_name ILIKE '%Prestige Ajax%' GROUP BY web_pid, product_name", format: 'JSONEachRow' });
    console.log("Ajax:");
    console.log(await res.json());

    process.exit(0);
}
test();
