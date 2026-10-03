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
        
        console.log("Tables in sugar database:");
        const res = await client.query({ 
            query: "SHOW TABLES", 
            format: 'JSONEachRow' 
        });
        const data = await res.json();
        console.log(data);
    } catch (err) {
        console.error("Error:", err);
    }
}
run();
