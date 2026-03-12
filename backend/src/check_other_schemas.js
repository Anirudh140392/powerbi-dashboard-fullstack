import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

async function getSchemas() {
    const tables = ['rca_sku_dim', 'rb_kw_olap', 'rb_ms_olap'];
    for (const table of tables) {
        try {
            console.log(`--- ${table} schema ---`);
            const result = await client.query({
                query: `DESCRIBE TABLE ${table}`,
                format: 'JSONEachRow',
            });
            const data = await result.json();
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.log(`${table} table not found: ${e.message}`);
        }
    }
    await client.close();
}

getSchemas();
