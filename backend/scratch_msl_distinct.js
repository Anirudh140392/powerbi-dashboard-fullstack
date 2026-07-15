import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB || 'pidilite',
  });
  try {
    const res = await client.query({
      query: 'DESCRIBE TABLE rb_pdp_olap',
      format: 'JSONEachRow'
    });
    const data = await res.json();
    console.log("Distinct msl values in pidilite:", data);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
