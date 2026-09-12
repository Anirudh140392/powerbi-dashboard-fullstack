import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { createClient } from '@clickhouse/client';

async function run() {
    try {
        const dbs = ['emami', 'godrej', 'pidilite', 'prestige', 'sugar'];
        for (const dbName of dbs) {
            try {
                const client = createClient({
                    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
                    username: process.env.CLICKHOUSE_USER || 'default',
                    password: process.env.CLICKHOUSE_PASSWORD || '',
                    database: dbName,
                });
                console.log(`--- SAMPLE FROM DB: ${dbName} ---`);
                const result = await client.query({
                    query: 'SELECT * FROM rb_pdp_week LIMIT 1',
                    format: 'JSONEachRow'
                });
                const rows = await result.json();
                console.log(rows[0]);
            } catch (err) {
                console.error(`Error querying ${dbName}:`, err.message);
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }
}
run();
