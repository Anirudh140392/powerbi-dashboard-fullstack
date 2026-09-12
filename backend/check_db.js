import { createClient } from '@clickhouse/client';

const client = createClient({
  url: 'http://13.203.251.97:8123',
  username: 'yash_user',
  password: 'yash@Gautam0100',
  database: 'default'
});

async function run() {
  const rs = await client.query({ query: 'DESCRIBE prestige.rca_pdp_olap' });
  const schema = await rs.json();
  console.log(schema.data.map(c => c.name));
}

run().catch(console.error);
