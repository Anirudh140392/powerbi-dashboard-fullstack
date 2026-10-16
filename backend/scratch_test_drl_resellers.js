import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: 'drl',
});

async function run() {
    try {
        console.log("Querying DRL database for reseller names...");
        const query = "SELECT DISTINCT Reseller_Name as value FROM rb_pdp_olap WHERE Reseller_Name IS NOT NULL AND Reseller_Name != '' LIMIT 10";
        const result = await client.query({
            query,
            format: 'JSONEachRow'
        });
        const rows = await result.json();
        console.log("DRL Reseller Names:", rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
