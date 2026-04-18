import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    const res = await queryClickHouse("DESCRIBE TABLE rb_sku_platform");
    console.log(res.map(r => r.name).join(', '));
}
test();
