import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { createClient } from '@clickhouse/client';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: 'drl',
});

async function run() {
    try {
        const results = await client.query({
            query: "SELECT DISTINCT Reseller_Name FROM rb_pdp_olap WHERE Reseller_Name != '' LIMIT 30",
            format: 'JSONEachRow'
        });
        const rows = await results.json();
        console.log("RESELLERS:", rows.map(r => r.Reseller_Name));
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();


