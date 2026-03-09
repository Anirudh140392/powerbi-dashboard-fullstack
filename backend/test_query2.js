import { createClient } from '@clickhouse/client';

(async () => {
    const client = createClient({
        url: 'http://13.200.55.131:8123',
        username: 'readonly_user',
        password: 'Readonly@123',
        database: 'mars'
    });
    try {
        const q1 = `SELECT MIN(DATE), MAX(DATE) FROM rb_pdp_olap WHERE Brand = 'Snickers' AND channel = 'QuickComm'`;
        const r1 = await client.query({ query: q1, format: 'JSONEachRow' });
        const rows1 = await r1.json();
        console.log("QuickComm Snickers Dates:", rows1);

        const q2 = `SELECT MIN(DATE), MAX(DATE) FROM rb_pdp_olap WHERE Brand = 'Snickers'`;
        const r2 = await client.query({ query: q2, format: 'JSONEachRow' });
        const rows2 = await r2.json();
        console.log("All Snickers Dates:", rows2);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
})();
