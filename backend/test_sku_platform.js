import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        const res = await queryClickHouse("SELECT * FROM rb_sku_platform LIMIT 1");
        console.log("rb_sku_platform sample:", res[0]);
    } catch(e) { console.log(e); }
}
test();
