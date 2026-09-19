import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config({ path: '../backend/.env' });

async function run() {
  const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB || 'mamaearth',
  });
  try {
    const res = await client.query({
      query: 'SELECT DISTINCT msl FROM rb_pdp_olap LIMIT 20',
      format: 'JSONEachRow'
    });
    const data = await res.json();
    console.log(`DB ${process.env.CLICKHOUSE_DB} distinct msl:`, data);
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
run();
