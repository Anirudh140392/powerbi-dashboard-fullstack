import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
  url: 'http://localhost:8123',
  database: 'mars',
  username: 'default',
  password: ''
});

(async () => {
  try {
    const r1 = await clickhouse.query({ query: "DESCRIBE TABLE rb_pdp_olap", format: 'JSONEachRow' });
    const d1 = await r1.json();
    console.log("rb_pdp_olap:", d1.filter(r => r.name.toLowerCase() === 'web_pid'));

    const r2 = await clickhouse.query({ query: "DESCRIBE TABLE rb_sku_platform", format: 'JSONEachRow' });
    const d2 = await r2.json();
    console.log("rb_sku_platform:", d2.filter(r => r.name.toLowerCase() === 'web_pid'));
  } catch (e) {
    console.error(e.message);
  }
})();
