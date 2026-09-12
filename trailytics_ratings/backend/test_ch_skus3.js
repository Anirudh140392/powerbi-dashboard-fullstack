import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT product_external_id, product_name FROM products WHERE product_name ILIKE '%Ajax%' LIMIT 5", format: 'JSONEachRow' });
    let rows = await res.json();
    console.log("Products (Ajax):");
    console.log(rows);

    if (rows.length > 0) {
        let pid = rows[0].product_external_id;
        console.log(`Checking ml_reviews for pid: ${pid}`);
        let res2 = await clickhouse.query({ query: `SELECT count() FROM ml_reviews WHERE web_pid = '${pid}'`, format: 'JSONEachRow' });
        console.log("ml_reviews count:");
        console.log(await res2.json());
        
        let res3 = await clickhouse.query({ query: `SELECT count() FROM reviews WHERE web_pid = '${pid}'`, format: 'JSONEachRow' });
        console.log("reviews count:");
        console.log(await res3.json());
    }

    process.exit(0);
}
test();
