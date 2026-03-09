import { createClient } from '@clickhouse/client';

(async () => {
  const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'mars'
  });
  try {
    const q1 = `SELECT count() as cnt FROM rb_pdp_olap WHERE Brand = 'Snickers' AND channel = 'QuickComm' AND DATE BETWEEN '2026-03-01' AND '2026-03-07'`;
    const r1 = await client.query({ query: q1, format: 'JSONEachRow' });
    const rows1 = await r1.json();
    console.log("Count for QuickComm 2026-03-01 to 2026-03-07:", rows1);

    const q2 = `SELECT count() as cnt FROM rb_pdp_olap WHERE Brand = 'Snickers' AND DATE BETWEEN '2026-03-01' AND '2026-03-07' AND channel IS NULL`;
    const r2 = await client.query({ query: q2, format: 'JSONEachRow' });
    const rows2 = await r2.json();
    console.log("Count for NULL channel 2026-03-01 to 2026-03-07:", rows2);

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
})();
