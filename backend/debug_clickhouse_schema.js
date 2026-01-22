import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function findSchema() {
    try {
        console.log('Current DB:', process.env.CLICKHOUSE_DB);

        const result = await clickhouse.query({
            query: "SELECT database, name, type FROM system.columns WHERE table = 'rb_pdp_olap' LIMIT 100",
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.table(data);

        if (data.length === 0) {
            console.log('No columns found for rb_pdp_olap in any database. Listing all tables:');
            const tables = await clickhouse.query({
                query: "SHOW TABLES",
                format: 'JSONEachRow',
            });
            console.log(await tables.json());
        }
    } catch (err) {
        console.error('❌ ClickHouse query failed:', err.message);
    }
}

findSchema();
