import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
  try {
    const res = await queryClickHouse("SELECT DISTINCT keyword_type FROM rca_pm_olap LIMIT 10");
    console.log("Distinct keyword_type values:", res.map(r => r.keyword_type));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
