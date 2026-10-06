
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function checkTable() {
    try {
        console.log("🔍 Checking tb_content_score_data...");
        const result = await clickhouse.query({
            query: 'SELECT * FROM tb_content_score_data LIMIT 1',
            format: 'JSONEachRow',
        });
        const data = await result.json();
        const fs = await import('fs');
        fs.writeFileSync('row_data.json', JSON.stringify(data[0], null, 2));
        console.log("✅ Written row data to row_data.json");
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

checkTable();
