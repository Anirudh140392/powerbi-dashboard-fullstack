import { queryClickHouse } from './backend/src/config/clickhouse.js';
async function test() {
    console.log(await queryClickHouse("DESCRIBE rb_test.rb_platform"));
    console.log(await queryClickHouse("DESCRIBE rb_test.rb_sku_platform"));
}
test();
