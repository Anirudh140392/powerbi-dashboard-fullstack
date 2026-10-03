import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: 'zydus',
});

async function run() {
    try {
        const result = await client.query({ query: 'DESCRIBE rb_sku_platform FORMAT JSON' });
        const json = await result.json();
        const columns = json.data.map(d => d.name);
        console.log("Columns in zydus.rb_sku_platform:");
        console.dir(columns, { maxArrayLength: null });

        const result2 = await client.query({ query: 'DESCRIBE rca_sku_dim FORMAT JSON' });
        const json2 = await result2.json();
        const columns2 = json2.data.map(d => d.name);
        console.log("Columns in zydus.rca_sku_dim:");
        console.dir(columns2, { maxArrayLength: null });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
