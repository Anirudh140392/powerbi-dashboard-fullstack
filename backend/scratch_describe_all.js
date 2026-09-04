import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: 'pidilite',
  });
  try {
    const res = await client.query({
      query: 'DESCRIBE TABLE rb_pm_olap',
      format: 'JSONEachRow'
    });
    const data = await res.json();
    console.log("rb_pm_olap columns in pidilite:", data.map(r => r.name || r.Name));
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
run();
