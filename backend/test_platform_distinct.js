import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    const list = await queryClickHouse(`SELECT Platform, count(*) as c FROM rb_pm_olap GROUP BY Platform`);
    console.log("pm_olap platform courts:", list);
}
test().catch(console.error).finally(() => process.exit(0));
