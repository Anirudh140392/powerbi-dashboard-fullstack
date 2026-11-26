import { createClient } from '@clickhouse/client';

const client = createClient({
  url: 'http://13.203.251.97:8123',
  username: 'yash_user',
  password: 'yash@Gautam0100',
  database: 'prestige'
});

async function run() {
  await client.command({ query: 'CREATE VIEW IF NOT EXISTS rb_pdp_olap AS SELECT * FROM rca_pdp_olap' });
  console.log('View created successfully!');
}

run().catch(console.error);
