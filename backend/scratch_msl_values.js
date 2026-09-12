import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const dbs = ['pidilite', 'mamaearth', 'boat', 'godrej'];
  for (const db of dbs) {
    const client = createClient({
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
      database: db,
    });
    try {
      const res = await client.query({
        query: 'SELECT DISTINCT MSL FROM rb_pdp_olap WHERE MSL IS NOT NULL LIMIT 20',
        format: 'JSONEachRow'
      });
      const data = await res.json();
      console.log(`DB ${db} MSL values (not null):`, data);

      const resCount = await client.query({
        query: 'SELECT MSL, count() as cnt FROM rb_pdp_olap GROUP BY MSL',
        format: 'JSONEachRow'
      });
      const dataCount = await resCount.json();
      console.log(`DB ${db} MSL group by:`, dataCount);
    } catch (e) {
      console.error(`DB ${db} failed:`, e.message);
    }
  }
  process.exit(0);
}
run();
