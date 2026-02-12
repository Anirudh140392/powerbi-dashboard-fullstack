import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@clickhouse/client';

// Load .env from backend folder
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function inspectTable() {
    try {
        console.log(`Connecting to ${process.env.CLICKHOUSE_URL} (DB: ${process.env.CLICKHOUSE_DB})...`);

        const schemaResult = await clickhouse.query({
            query: "SELECT name, type FROM system.columns WHERE table = 'rb_kw' AND database = currentDatabase()",
            format: 'JSONEachRow',
        });
        const columns = await schemaResult.json();
        console.log('--- rb_kw Schema ---');
        console.table(columns);

        const sampleResult = await clickhouse.query({
            query: "SELECT * FROM rb_kw LIMIT 1",
            format: 'JSONEachRow',
        });
        const samples = await sampleResult.json();
        console.log('--- Sample Row ---');
        console.log(JSON.stringify(samples[0], null, 2));

    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

inspectTable();
