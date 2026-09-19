import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: 'DESCRIBE TABLE reviews', format: 'JSONEachRow' });
    console.log("REVIEWS:");
    console.log(await res.json());

    res = await clickhouse.query({ query: 'DESCRIBE TABLE stakeholder_mappings', format: 'JSONEachRow' });
    console.log("STAKEHOLDER_MAPPINGS:");
    console.log(await res.json());

    res = await clickhouse.query({ query: 'DESCRIBE TABLE products', format: 'JSONEachRow' });
    console.log("PRODUCTS:");
    console.log(await res.json());

    process.exit(0);
}
test();
