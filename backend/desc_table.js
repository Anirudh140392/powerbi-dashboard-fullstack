import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

async function main() {
  try {
    const res = await queryClickHouse('DESCRIBE rb_kw_olap');
    console.log(JSON.stringify(res, null, 2));
  } catch(e) { console.error(e); }
  process.exit(0);
}
main();
