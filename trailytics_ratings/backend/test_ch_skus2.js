import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT web_pid, product_name FROM product_snapshots WHERE product_name ILIKE '%Ajax%' LIMIT 1", format: 'JSONEachRow' });
    console.log("Ajax in snapshots:");
    console.log(await res.json());

    res = await clickhouse.query({ query: "SELECT count() FROM reviews WHERE product_name ILIKE '%Ajax%'", format: 'JSONEachRow' });
    console.log("Ajax in reviews:");
    console.log(await res.json());

    process.exit(0);
}
test();

