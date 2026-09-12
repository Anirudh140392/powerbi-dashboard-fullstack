import clickhouse from './src/config/clickhouse.js';
async function test() {
    // Find a web_pid with rating 4.0 - 4.2 that has issues
    const query = `
        SELECT web_pid, product_name, rating
        FROM product_snapshots
        WHERE rating >= 4.0 AND rating < 4.2
        LIMIT 5
    `;
    let res = await clickhouse.query({ query, format: 'JSONEachRow' });
    console.log("SKUs with Rating 4.0 - 4.2:");
    console.log(await res.json());

    process.exit(0);
}
test();
