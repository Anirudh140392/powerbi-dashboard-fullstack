import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function exploreData() {
    try {
        const schema = await clickhouse.query({
            query: 'DESCRIBE TABLE rb_pdp_olap',
            format: 'JSONEachRow',
        });
        const schemaData = await schema.json();
        console.log('--- SCHEMA ---');
        console.table(schemaData);

        const sample = await clickhouse.query({
            query: 'SELECT * FROM rb_pdp_olap ORDER BY DATE DESC LIMIT 1',
            format: 'JSONEachRow',
        });
        const sampleData = await sample.json();
        console.log('--- LATEST DATA SAMPLE ---');
        console.log(JSON.stringify(sampleData, null, 2));
    } catch (err) {
        console.error('❌ ClickHouse query failed:', err.message);
    }
}

exploreData();
