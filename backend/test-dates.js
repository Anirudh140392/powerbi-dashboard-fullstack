import { connectClickHouse, queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    await connectClickHouse();
    const result = await queryClickHouse(`SELECT max(DATE), min(DATE) FROM rb_kw_olap`);
    console.log(result);
    process.exit(0);
}
test();
