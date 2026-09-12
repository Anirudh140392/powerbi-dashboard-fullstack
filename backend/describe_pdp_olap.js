import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function describeTable() {
    try {
        console.log(`Describing table rb_pdp_olap in DB: ${process.env.CLICKHOUSE_DB}`);
        const result = await clickhouse.query({
            query: 'DESCRIBE TABLE rb_pdp_olap',
            format: 'JSONEachRow',
        });
        const data = await result.json();

        let output = "--- Schema for rb_pdp_olap ---\n";
        output += JSON.stringify(data, null, 2);

        fs.writeFileSync('pdp_schema.txt', output);
        console.log("✅ Schema written to pdp_schema.txt");
    } catch (err) {
        console.error('❌ ClickHouse query failed:', err.message);
    }
}

describeTable();
