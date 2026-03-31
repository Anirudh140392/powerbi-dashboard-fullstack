import { queryClickHouse } from './src/utils/clickhouse.js';

async function run() {
  try {
    const res = await queryClickHouse("SELECT * FROM rb_pm_olap LIMIT 1");
    console.log(Object.keys(res[0]));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
