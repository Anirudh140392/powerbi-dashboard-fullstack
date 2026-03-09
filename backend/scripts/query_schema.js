import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
  url: 'http://localhost:8123',
  username: 'default',
  password: '',
  database: 'default'
});

async function run() {
  const result = await clickhouse.query({
    query: 'DESCRIBE TABLE rb_pdp_olap',
    format: 'JSONEachRow',
  });
  console.log(await result.json());
  process.exit(0);
}
run();
