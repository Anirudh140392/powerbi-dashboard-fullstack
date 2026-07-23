import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
  try {
    const result = await queryClickHouse("DESCRIBE mars.rb_product_verify");
    console.log("mars.rb_product_verify columns:", result.map(r => r.name).join(', '));
  } catch (e) { console.error(e); }
}
test().catch(console.error);
