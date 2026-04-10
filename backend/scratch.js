import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    console.log(await queryClickHouse("DESCRIBE rb_platform"));
    console.log("-------");
    console.log(await queryClickHouse("DESCRIBE rb_sku_platform"));
    process.exit(0);
}
test();
