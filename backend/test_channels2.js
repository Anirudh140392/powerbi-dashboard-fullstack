import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
  try {
    const res = await queryClickHouse("SELECT DISTINCT CHANNEL FROM prestige.rca_sku_dim");
    console.log("rca_sku_dim channels:", res);
    
    const res2 = await queryClickHouse("SELECT DISTINCT channel FROM prestige.rb_pdp_olap");
    console.log("rb_pdp_olap channels:", res2);
  } catch (e) { console.error(e); }
}
test();
