import { createClient } from '@clickhouse/client';

(async () => {
    const client = createClient({
        url: 'http://13.200.55.131:8123',
        username: 'readonly_user',
        password: 'Readonly@123',
        database: 'mars'
    });
    try {
        const q1 = `SELECT DATE, count() as cnt FROM rb_pdp_olap WHERE Brand = 'Snickers' AND channel = 'QuickComm' AND DATE >= '2026-01-01' GROUP BY DATE ORDER BY DATE DESC LIMIT 15`;
        const r1 = await client.query({ query: q1, format: 'JSONEachRow' });
        const rows1 = await r1.json();
        console.log("QuickComm Snickers Recent Dates:");
        console.table(rows1);

        const q2 = `SELECT DATE, count() as cnt FROM rb_pdp_olap WHERE Brand = 'Snickers' AND DATE >= '2026-03-01' GROUP BY DATE ORDER BY DATE DESC LIMIT 15`;
        const r2 = await client.query({ query: q2, format: 'JSONEachRow' });
        const rows2 = await r2.json();
        console.log("All Snickers Recent Dates:");
        console.table(rows2);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
})();
