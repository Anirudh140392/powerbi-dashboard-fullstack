import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function testConn() {
    try {
        const result = await clickhouse.query({
            query: 'SELECT currentDatabase(), now()',
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('✅ Connected to ClickHouse');
        console.log('Result:', data);

        const tables = await clickhouse.query({
            query: 'SHOW TABLES',
            format: 'JSONEachRow',
        });
        const tableData = await tables.json();
        console.log('Tables:', tableData);
    } catch (err) {
        console.error('❌ ClickHouse connection failed:', err.message);
    }
}

testConn();
