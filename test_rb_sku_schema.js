import { queryClickHouse } from './backend/src/config/clickhouse.js';

async function test() {
  const result = await queryClickHouse(`SELECT web_pid, image_url FROM rb_sku_platform LIMIT 5`);
  console.log("TEST RESULT:", result);
}
test();
