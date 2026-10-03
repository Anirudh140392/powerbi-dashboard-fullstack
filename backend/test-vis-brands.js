import { connectClickHouse, queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    await connectClickHouse();
    const result = await queryClickHouse(`SELECT DISTINCT brand FROM rb_kw_olap LIMIT 10`);
    console.log(result);
    process.exit(0);
}
test();
