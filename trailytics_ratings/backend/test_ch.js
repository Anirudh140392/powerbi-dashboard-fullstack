import clickhouse from './src/config/clickhouse.js';
async function test() {
    const res = await clickhouse.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
    const rows = await res.json();
    console.log(rows);
    process.exit(0);
}
test();
