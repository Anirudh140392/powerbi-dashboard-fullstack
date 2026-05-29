import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    const list = await queryClickHouse(`SELECT DISTINCT channel FROM rb_pm_olap LIMIT 10`);
    console.log("distinct channels:", list);
}
test().catch(console.error).finally(() => process.exit(0));
