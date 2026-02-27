import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
  try {
    const res1 = await queryClickHouse("SELECT min(DATE), max(DATE), count() FROM rb_pdp_olap");
    console.log("rb_pdp_olap range:", res1);
    
    const res2 = await queryClickHouse("SELECT min(created_on), max(created_on), count() FROM rb_brand_ms");
    console.log("rb_brand_ms range:", res2);
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
