import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    const list = await queryClickHouse(`SELECT channel, count(*) as c FROM rb_pm_olap GROUP BY channel`);
    console.log("pm_olap channel count:", list);
}
test().catch(console.error).finally(() => process.exit(0));
