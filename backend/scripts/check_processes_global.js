import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    // NO DATABASE SPECIFIED
});

async function checkProcessesGlobal() {
    try {
        const result = await clickhouse.query({
            query: "SELECT query_id, user, query, elapsed, read_rows, database FROM system.processes",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.table(data);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

checkProcessesGlobal();
