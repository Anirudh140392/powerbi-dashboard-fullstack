import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function checkProcesses() {
    try {
        const result = await clickhouse.query({
            query: "SELECT query_id, user, query, elapsed, read_rows FROM system.processes WHERE database = currentDatabase()",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.table(data);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

checkProcesses();
