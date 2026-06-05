import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { createClient } from '@clickhouse/client';

async function run() {
    try {
        const client = createClient({
            url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
            username: process.env.CLICKHOUSE_USER || 'default',
            password: process.env.CLICKHOUSE_PASSWORD || '',
            database: 'sugar',
        });
        
        console.log("Describing rb_pdp_week in 'sugar' database:");
        const res = await client.query({ query: "DESCRIBE TABLE rb_pdp_week", format: 'JSONEachRow' });
        const data = await res.json();
        for (const col of data) {
            console.log(`${col.name}: ${col.type}`);
        }
    } catch (err) {
        console.error("Error:", err);
    }
}
run();
