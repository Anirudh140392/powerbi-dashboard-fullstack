import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
  try {
    const res = await queryClickHouse("SELECT DISTINCT Platform, Channel FROM mars.rb_pdp_olap LIMIT 10");
    console.log(res);
  } catch (e) { console.error(e); }
}
test().catch(console.error);
