import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars'
});

async function run() {
    try {
        const rs = await clickhouse.query({ query: "DESCRIBE TABLE rb_product_verify", format: 'JSON' });
        const data = await rs.json();
        console.log("Columns:", data.data.map(d => d.name).join(", "));
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}
run();
