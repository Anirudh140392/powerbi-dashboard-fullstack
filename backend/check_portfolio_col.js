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
        
        console.log("Searching for 'portfolio' columns in ClickHouse:");
        const res = await client.query({ 
            query: "SELECT database, table, name, type FROM system.columns WHERE database != 'system' AND (lower(name) LIKE '%portfolio%' OR lower(table) LIKE '%portfolio%')", 
            format: 'JSONEachRow' 
        });
        const data = await res.json();
        console.log(data);
    } catch (err) {
        console.error("Error:", err);
    }
}
run();
