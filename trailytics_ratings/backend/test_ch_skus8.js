import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT web_pid, product_name, platform, rating FROM product_snapshots LIMIT 5", format: 'JSONEachRow' });
    console.log("Snapshots 5:");
    console.log(await res.json());

    process.exit(0);
}
test();
