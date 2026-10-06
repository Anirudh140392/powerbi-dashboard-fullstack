import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
  try {
    const res = await queryClickHouse("SELECT DISTINCT channel FROM mars.rca_sku_dim");
    console.log(res);
  } catch (e) { console.error(e); }
}
test().catch(console.error);
