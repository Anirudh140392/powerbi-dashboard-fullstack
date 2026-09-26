import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function listColumns() {
    try {
        const result = await clickhouse.query({
            query: "SELECT name, type FROM system.columns WHERE table = 'rb_pdp_olap' AND database = 'GCPL'",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.table(data);
    } catch (err) {
        console.error('❌ ClickHouse query failed:', err.message);
    }
}

listColumns();
