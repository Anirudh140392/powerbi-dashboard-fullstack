
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'readonly_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Readonly@123',
    database: process.env.CLICKHOUSE_DB || 'colpal',
    request_timeout: 30000,
});

async function checkColumns() {
    try {
        console.log('Checking columns for test_brand_MS...');
        const result = await clickhouse.query({
            query: "SELECT name FROM system.columns WHERE table = 'test_brand_MS' AND database = '" + (process.env.CLICKHOUSE_DB || 'colpal') + "'",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('Found columns:');
        data.forEach(row => {
            console.log(row.name);
        });
    } catch (err) {
        console.error('❌ ClickHouse query failed:', err.message);
    }
}

checkColumns();
