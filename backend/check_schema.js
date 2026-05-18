import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
    host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars'
});

async function run() {
    const rs = await clickhouse.query({ query: "DESCRIBE TABLE rb_product_verify", format: 'JSON' });
    const data = await rs.json();
    console.log(data.data.map(d => d.name));
    process.exit(0);
}
run();
