import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
  try {
    const res = await queryClickHouse("DESCRIBE TABLE danone.rb_content_olap");
    console.log(res.map(r => r.name).join(', '));
  } catch (e) { console.error(e); }
}
test();
