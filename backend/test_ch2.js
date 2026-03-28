import { createClient } from '@clickhouse/client';
const client = createClient({ url: 'http://13.200.55.131:8123', username: 'readonly_user', password: 'Readonly@123', database: 'mars' });

async function run() {
    try {
        const qSku = `
            SELECT 
                'test' as sku_name,
                ROUND((10 / NULLIF((SELECT 20), 0)) * 100, 1) as overall_sos
        `;
        const res = await client.query({ query: qSku, format: 'JSONEachRow' });
        const data = await res.json();
        console.log("Subquery test result:", data);

    } catch(e) { console.error(e); }
    client.close();
}
run();
