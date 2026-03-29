import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        const res = await queryClickHouse("SELECT DISTINCT Platform, count() FROM rb_pdp_olap GROUP BY Platform");
        console.log(res);
    } catch (e) {
        console.error(e);
    }
}
test();
