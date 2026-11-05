import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT web_pid, product_name FROM product_snapshots WHERE lower(product_name) LIKE '%ajax%' LIMIT 5", format: 'JSONEachRow' });
    console.log("Snapshots:");
    console.log(await res.json());

    let res2 = await clickhouse.query({ query: "SELECT product_external_id, product_name FROM products WHERE lower(product_name) LIKE '%ajax%' LIMIT 5", format: 'JSONEachRow' });
    console.log("Products:");
    console.log(await res2.json());
    
    let res3 = await clickhouse.query({ query: "SELECT web_pid, product_name FROM ml_reviews WHERE lower(product_name) LIKE '%ajax%' LIMIT 1", format: 'JSONEachRow' });
    console.log("ML Reviews:");
    console.log(await res3.json());
    
    process.exit(0);
}
test();
