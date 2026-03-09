import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'default',
    request_timeout: 60000,
});

async function run() {
    // Step 1: Get actual column names
    console.log('--- Checking table columns ---');
    const cols = await client.query({ query: "SELECT name FROM system.columns WHERE table = 'rb_pdp_olap' LIMIT 50", format: 'JSONEachRow' });
    const colRows = await cols.json();
    console.log('Columns:', colRows.map(r => r.name).join(', '));

    // Step 2: Get sample row
    console.log('\n--- Sample Row ---');
    const sample = await client.query({ query: "SELECT * FROM rb_pdp_olap LIMIT 1", format: 'JSONEachRow' });
    const sampleRows = await sample.json();
    console.log(JSON.stringify(sampleRows[0], null, 2));

    // Step 3: Get count of rows and date range in table
    console.log('\n--- Date range and count ---');
    const dateQ = await client.query({ query: "SELECT count() as cnt, min(DATE) as min_date, max(DATE) as max_date FROM rb_pdp_olap", format: 'JSONEachRow' });
    const dateRows = await dateQ.json();
    console.log(JSON.stringify(dateRows[0], null, 2));

    // Step 4: Simple group by Category
    console.log('\n--- Categories in table ---');
    const catQ = await client.query({ query: "SELECT Category, count() as cnt FROM rb_pdp_olap GROUP BY Category ORDER BY cnt DESC LIMIT 20", format: 'JSONEachRow' });
    const catRows = await catQ.json();
    catRows.forEach(r => console.log(r.Category, ':', r.cnt));

    await client.close();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
