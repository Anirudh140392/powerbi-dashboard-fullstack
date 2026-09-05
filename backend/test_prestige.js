import { queryClickHouse } from './src/config/clickhouse.js';
async function run() {
  try {
    const tables = await queryClickHouse("SHOW TABLES FROM prestige");
    console.log(tables);
  } catch(e){ console.error(e) }
}
run();
