import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    const data = await queryClickHouse(`SELECT DISTINCT Platform FROM rb_pdp_olap`);
    console.log(data);
    process.exit(0);
}
test();
