import { createClient } from '@clickhouse/client';
const client = createClient({
  url: 'http://13.200.55.131:8123',
  username: 'readonly_user',
  password: 'Readonly@123',
  database: 'mamaearth'
});
async function run() {
  const result = await client.query({ query: 'DESCRIBE TABLE rb_sku_platform', format: 'JSONEachRow' });
  const data = await result.json();
  console.log(data);
}
run().catch(console.error);
