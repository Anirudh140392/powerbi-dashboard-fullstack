import 'dotenv/config';
import clickhouse from './src/config/clickhouse.js';

async function run() {
  try {
    const res = await clickhouse.query({ query: 'DESCRIBE rb_kw_olap', format: 'JSONEachRow' });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
