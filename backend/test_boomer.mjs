import { queryClickHouse } from './src/config/clickhouse.js';
async function run() {
  try {
    const rows = await queryClickHouse("SELECT brand, keyword, impressions FROM rca_pm_olap WHERE brand LIKE '%Boomer%' LIMIT 5");
    console.log("ROWS:", rows);
  } catch(e) { console.error("ERROR:", e); }
  process.exit(0);
}
run();
