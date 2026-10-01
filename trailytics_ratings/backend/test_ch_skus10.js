import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT web_pid, product_name, rating FROM product_snapshots WHERE rating >= 4.0 AND rating < 4.2 AND company_id = '297e37ea-a5ac-47df-bebd-ac44e52b7979' AND is_competitor = 0 ORDER BY rating_count DESC LIMIT 10", format: 'JSONEachRow' });
    console.log("No Issue SKUs:");
    console.log(await res.json());

    process.exit(0);
}
test();
