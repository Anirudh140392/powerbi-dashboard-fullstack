import { queryClickHouse } from './backend/src/config/clickhouse.js';
async function test() {
    try {
        const res = await queryClickHouse("SELECT name FROM system.columns WHERE table = 'rb_sku_platform' AND database = 'mars' FORMAT JSONEachRow");
        console.log(res);
    } catch(e) { console.error(e.message); }
}
test();
